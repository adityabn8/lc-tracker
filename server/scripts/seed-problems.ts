/**
 * Seed the problems table from LeetCode's public GraphQL API,
 * falling back to data/problems.json if the network call fails.
 *
 * Run: npx tsx scripts/seed-problems.ts
 * Or:  npm run seed (from server/)
 */
import { PrismaClient, Difficulty } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const FALLBACK_PATH = path.resolve(__dirname, "../../data/problems.json");
const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

interface LCProblem {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  topicTags: { slug: string }[];
}

interface ProblemRecord {
  id: number;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  url: string;
}

async function fetchFromLeetCode(): Promise<ProblemRecord[]> {
  const query = `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          questionFrontendId
          title
          titleSlug
          difficulty
          topicTags { slug }
        }
      }
    }
  `;

  const PAGE_SIZE = 500;
  let skip = 0;
  let total = Infinity;
  const all: LCProblem[] = [];

  while (skip < total) {
    const res = await fetch(LEETCODE_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { categorySlug: "", limit: PAGE_SIZE, skip, filters: {} },
      }),
    });

    if (!res.ok) throw new Error(`LeetCode GraphQL returned ${res.status}`);
    const json = (await res.json()) as {
      data: { problemsetQuestionList: { total: number; questions: LCProblem[] } };
    };

    const page = json.data.problemsetQuestionList;
    total = page.total;
    all.push(...page.questions);
    skip += PAGE_SIZE;
    console.log(`Fetched ${all.length} / ${total}`);
  }

  return all
    .filter((q) => !isNaN(parseInt(q.questionFrontendId, 10)))
    .map((q) => ({
      id: parseInt(q.questionFrontendId, 10),
      title: q.title,
      slug: q.titleSlug,
      difficulty: q.difficulty.toUpperCase() as "EASY" | "MEDIUM" | "HARD",
      tags: q.topicTags.map((t) => t.slug),
      url: `https://leetcode.com/problems/${q.titleSlug}/`,
    }));
}

async function loadFallback(): Promise<ProblemRecord[]> {
  if (!fs.existsSync(FALLBACK_PATH)) {
    throw new Error(`Fallback file not found at ${FALLBACK_PATH}`);
  }
  return JSON.parse(fs.readFileSync(FALLBACK_PATH, "utf-8")) as ProblemRecord[];
}

async function main() {
  let problems: ProblemRecord[];

  console.log("Attempting to fetch from LeetCode GraphQL...");
  try {
    problems = await fetchFromLeetCode();
    console.log(`Fetched ${problems.length} problems from LeetCode`);

    // Save as fallback for offline installs
    fs.mkdirSync(path.dirname(FALLBACK_PATH), { recursive: true });
    fs.writeFileSync(FALLBACK_PATH, JSON.stringify(problems, null, 2));
    console.log(`Saved to ${FALLBACK_PATH}`);
  } catch (err) {
    console.warn("LeetCode fetch failed, falling back to local file:", (err as Error).message);
    problems = await loadFallback();
    console.log(`Loaded ${problems.length} problems from fallback`);
  }

  // Upsert in batches to avoid hitting Postgres parameter limits
  const BATCH = 200;
  let upserted = 0;

  for (let i = 0; i < problems.length; i += BATCH) {
    const batch = problems.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((p) =>
        prisma.problem.upsert({
          where: { id: p.id },
          update: {
            title: p.title,
            slug: p.slug,
            difficulty: p.difficulty as Difficulty,
            tags: p.tags,
            url: p.url,
          },
          create: {
            id: p.id,
            title: p.title,
            slug: p.slug,
            difficulty: p.difficulty as Difficulty,
            tags: p.tags,
            url: p.url,
          },
        })
      )
    );
    upserted += batch.length;
    console.log(`Upserted ${upserted} / ${problems.length}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
