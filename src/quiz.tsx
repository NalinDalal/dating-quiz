import { useEffect, useMemo, useState } from "react";

// --- Types ---
type QuestionType = "single" | "multi";
interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
}

type AnswerMap = {
  [key: string]: string | string[] | null;
};

interface Profile {
  id: string;
  name: string;
  bio: string;
  answers: { [key: string]: string | string[] };
  avatar: string;
}

interface ScoredProfile extends Profile {
  score: number;
}

// --- Configuration ---------------------------------------------------------
const QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "What is most important to you in a relationship?",
    type: "single",
    options: [
      "Trust and honesty",
      "Fun and adventure",
      "Emotional support",
      "Shared goals and values",
    ],
  },
  {
    id: "q2",
    text: "How do you prefer to spend a romantic evening?",
    type: "single",
    options: [
      "Candlelit dinner",
      "Dancing or live music",
      "Stargazing or walk on the beach",
      "Cooking together at home",
    ],
  },
  {
    id: "q3",
    text: "Which trait attracts you most in a partner?",
    type: "single",
    options: ["Sense of humor", "Ambition", "Kindness", "Creativity"],
  },
  {
    id: "q4",
    text: "What are your favorite date activities? (Select all that apply)",
    type: "multi",
    options: [
      "Trying new restaurants",
      "Outdoor adventures",
      "Movie nights",
      "Art or music events",
    ],
  },
];

// Example "database" of profiles. answers MUST match options above.
const PROFILES: Profile[] = [
  {
    id: "alice",
    name: "Alice",
    bio: "Loves trails, trying new restaurants and painting.",
    answers: {
      q1: "Fun and adventure",
      q2: "Stargazing or walk on the beach",
      q3: "Creativity",
      q4: ["Outdoor adventures", "Art or music events"],
    },
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "bob",
    name: "Bob",
    bio: "Movie buff who enjoys cooking and quiet nights in.",
    answers: {
      q1: "Emotional support",
      q2: "Cooking together at home",
      q3: "Sense of humor",
      q4: ["Movie nights", "Trying new restaurants"],
    },
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  {
    id: "carla",
    name: "Carla",
    bio: "Books, calm walks and art openings.",
    answers: {
      q1: "Trust and honesty",
      q2: "Candlelit dinner",
      q3: "Kindness",
      q4: ["Art or music events"],
    },
    avatar: "https://i.pravatar.cc/150?img=22",
  },
  {
    id: "dan",
    name: "Dan",
    bio: "Outgoing, loves festivals and outdoor sports.",
    answers: {
      q1: "Shared goals and values",
      q2: "Dancing or live music",
      q3: "Ambition",
      q4: ["Outdoor adventures", "Trying new restaurants"],
    },
    avatar: "https://i.pravatar.cc/150?img=32",
  },
];

// ----------------- Utility: Vectorize answers -------------------------------
function buildFeatureMap(questions: Question[]) {
  const map: { [key: string]: number } = {};
  let idx = 0;
  for (const q of questions) {
    for (const opt of q.options) {
      map[`${q.id}::${opt}`] = idx++;
    }
  }
  return { map, length: idx };
}

function answersToVector(
  answers: AnswerMap,
  featureMapLength: number,
  featureMap: { [key: string]: number }
): number[] {
  const vec = new Array(featureMapLength).fill(0);
  for (const key of Object.keys(answers)) {
    const val = answers[key];
    if (Array.isArray(val)) {
      for (const v of val) {
        const k = `${key}::${v}`;
        if (k in featureMap) vec[featureMap[k]] = 1;
      }
    } else if (val) {
      const k = `${key}::${val}`;
      if (k in featureMap) vec[featureMap[k]] = 1;
    }
  }
  return vec;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

function cosineSim(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

// ----------------- Main Component -------------------------------------------
export default function QuizMatchDemo() {
  const { map: featureMap, length: featureLen } = useMemo(
    () => buildFeatureMap(QUESTIONS),
    []
  );

  const [step, setStep] = useState<"name" | "quiz" | "counting" | "results">(
    "name"
  );
  const [userName, setUserName] = useState<string>("");
  const [currentQ, setCurrentQ] = useState<number>(0);
  const [randomQuestions, setRandomQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [count, setCount] = useState<number>(5);
  const [matches, setMatches] = useState<ScoredProfile[]>([]);
  const [processingText, setProcessingText] = useState<string>(
    "Analyzing answers..."
  );

  // When entering quiz step, shuffle + pick up to 4 (we only have 4 questions here)
  useEffect(() => {
    if (step === "quiz") {
      const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
      const pick = shuffled.slice(0, Math.min(5, shuffled.length));
      setRandomQuestions(pick);
      setCurrentQ(0);
      const initial: AnswerMap = {};
      for (const q of pick) {
        initial[q.id] = q.type === "multi" ? [] : null;
      }
      setAnswers(initial);
    }
  }, [step]);

  function toggleAnswer(qid: string, opt: string) {
    setAnswers((prev) => {
      const cur = prev[qid];
      const q = randomQuestions.find((x) => x.id === qid);
      if (!q) return prev;
      if (q.type === "multi") {
        const setCur = new Set<string>(Array.isArray(cur) ? (cur as string[]) : []);
        if (setCur.has(opt)) setCur.delete(opt);
        else setCur.add(opt);
        return { ...prev, [qid]: Array.from(setCur) };
      } else {
        return { ...prev, [qid]: opt };
      }
    });
  }

  function startCountdown() {
    setStep("counting");
    setCount(5);
    setProcessingText("Analyzing answers...");
  }

  useEffect(() => {
    if (step !== "counting") return;
    if (count <= 0) {
      runMatching();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 900);
    return () => clearTimeout(id);
  }, [step, count]);

  function runMatching() {
    setProcessingText("Computing compatibility...");

    const userVec = answersToVector(answers, featureLen, featureMap);

    const scored: ScoredProfile[] = PROFILES.map((p) => {
      const pVec = answersToVector(p.answers as AnswerMap, featureLen, featureMap);
      const sim = cosineSim(userVec, pVec);

      let exactMatches = 0;
      let partialMatches = 0;
      for (const q of QUESTIONS) {
        const ua = answers[q.id];
        const pa = p.answers[q.id];
        if (Array.isArray(ua) && Array.isArray(pa)) {
          const shared = (ua as string[]).filter((x) => (pa as string[]).includes(x));
          if (shared.length > 0) exactMatches++;
          partialMatches += shared.length;
        } else if (Array.isArray(ua) && !Array.isArray(pa) && pa) {
          if ((ua as string[]).includes(pa as string)) exactMatches++;
        } else if (!Array.isArray(ua) && Array.isArray(pa) && ua) {
          if ((pa as string[]).includes(ua as string)) exactMatches++;
        } else if (ua && pa && ua === pa) {
          exactMatches++;
        }
      }

      const bonus = (exactMatches / QUESTIONS.length) * 0.2 + partialMatches * 0.03;
      const missing = QUESTIONS.filter(
        (q) =>
          !answers[q.id] ||
          (Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length === 0)
      ).length;
      const penalty = missing * 0.05;
      const finalScore = Math.max(0, Math.min(1, sim + bonus - penalty));
      return { ...p, score: finalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    setMatches(scored);
    setStep("results");
  }

  function reset() {
    const initial: AnswerMap = {};
    for (const q of QUESTIONS) initial[q.id] = q.type === "multi" ? [] : null;
    setAnswers(initial);
    setMatches([]);
    setStep("quiz");
    setUserName("");
  }

  const incomplete = randomQuestions.some(
    (q) => q.type === "single" && !answers[q.id]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-love-gradient p-6">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white/20">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="text-4xl animate-heartbeat">💕</div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-sky-600 bg-clip-text text-transparent tracking-tight">
              Love Match
            </h1>
          </div>
          <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Reset
          </button>
        </header>

        {step === "name" && (
          <section className="flex flex-col items-center gap-6 animate-fade-in">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-heartbeat">💖</div>
              <h2 className="text-2xl font-bold text-pink-600 mb-2">Welcome to Love Match!</h2>
              <div className="text-lg text-slate-600">What's your name?</div>
            </div>
            <input
              className="border-2 border-pink-200 rounded-xl px-6 py-3 text-lg focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all w-full shadow-lg"
              type="text"
              value={userName}
              placeholder="Enter your name"
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && userName.trim()) setStep("quiz");
              }}
              autoFocus
            />
            <button
              className={`px-8 py-3 rounded-xl text-white font-bold text-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all transform hover:scale-105 shadow-xl disabled:opacity-50 disabled:transform-none`}
              disabled={!userName.trim()}
              onClick={() => setStep("quiz")}
            >
              Start My Love Story ✨
            </button>
          </section>
        )}

        {step === "quiz" && randomQuestions.length > 0 && (
          <section className="animate-fade-in">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-500">Question {currentQ + 1} of {randomQuestions.length}</span>
                <span className="text-sm text-slate-500">{Math.round(((currentQ + 1) / randomQuestions.length) * 100)}% Complete</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-pink-400 to-sky-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((currentQ + 1) / randomQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="border-2 border-pink-200 rounded-2xl p-8 mb-6 bg-gradient-to-br from-pink-50 via-white to-sky-50 shadow-xl">
              <h3 className="font-bold text-xl mb-4 text-pink-700 text-center">
                {randomQuestions[currentQ].text}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {randomQuestions[currentQ].options.map((opt, index) => {
                  const selected = Array.isArray(answers[randomQuestions[currentQ].id])
                    ? (answers[randomQuestions[currentQ].id] as string[]).includes(opt)
                    : answers[randomQuestions[currentQ].id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleAnswer(randomQuestions[currentQ].id, opt)}
                      className={
                        `p-4 text-left rounded-xl border-2 transition-all transform hover:scale-105 font-medium text-lg shadow-md ` +
                        (selected
                          ? "bg-gradient-to-r from-pink-100 to-sky-100 border-pink-400 text-pink-700 shadow-xl scale-105"
                          : "bg-white border-slate-200 hover:bg-sky-50 hover:border-sky-300")
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{['❤️', '💕', '💖', '💘'][index % 4]}</span>
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <button
                className="px-6 py-3 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all transform hover:scale-105 shadow-md"
                onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
                disabled={currentQ === 0}
              >
                ← Previous
              </button>
              {currentQ < randomQuestions.length - 1 ? (
                <button
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-lg hover:from-pink-600 hover:to-rose-600 transition-all transform hover:scale-105 shadow-xl disabled:opacity-50"
                  disabled={randomQuestions[currentQ].type === "single" && !answers[randomQuestions[currentQ].id]}
                  onClick={() => setCurrentQ((q) => q + 1)}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white font-bold text-lg hover:from-sky-600 hover:to-blue-600 transition-all transform hover:scale-105 shadow-xl disabled:opacity-50"
                  disabled={incomplete}
                  onClick={startCountdown}
                >
                  Find My Match 💕
                </button>
              )}
            </div>
          </section>
        )}

        {step === "counting" && (
          <section className="text-center py-12 animate-fade-in">
            <div className="text-8xl font-bold mb-6 animate-pulse text-pink-600">{count}</div>
            <div className="text-xl text-slate-600 mb-8 font-medium">{processingText}</div>
            <div className="relative w-full bg-slate-200 h-4 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-pink-400 via-rose-400 to-sky-400 transition-all duration-1000 shadow-lg"
                style={{ width: `${((5 - count) / 5) * 100}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white drop-shadow-lg">
                  {Math.round(((5 - count) / 5) * 100)}%
                </span>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <div className="animate-sparkle text-4xl">✨</div>
            </div>
          </section>
        )}

        {step === "results" && matches.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4 text-center text-pink-600">Your Ideal Match</h2>
            {/* Top match card */}
            <div className="relative flex flex-col items-center justify-center mb-8">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-block bg-gradient-to-r from-pink-400 to-sky-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg animate-bounce">Ideal Partner</span>
              </div>
              <div className="w-full max-w-md bg-gradient-to-br from-pink-50 to-sky-50 rounded-2xl shadow-xl p-6 flex flex-col items-center border-2 border-pink-200">
                <img src={matches[0].avatar} alt={matches[0].name} className="w-24 h-24 rounded-full object-cover border-4 border-pink-300 shadow-lg mb-3" />
                <div className="text-xl font-bold text-pink-700 mb-1">{matches[0].name}</div>
                <div className="text-sm text-slate-500 mb-2 text-center">{matches[0].bio}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400">Compatibility</span>
                  <span className="text-lg font-bold text-sky-600">{Math.round(matches[0].score * 100)}%</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {QUESTIONS.map((q) => {
                    const ua = answers[q.id];
                    const pa = matches[0].answers[q.id];
                    let shared: string[] = [];
                    if (Array.isArray(ua) && Array.isArray(pa)) {
                      shared = (ua as string[]).filter((x) => (pa as string[]).includes(x));
                    } else if (Array.isArray(ua) && !Array.isArray(pa) && pa) {
                      shared = (ua as string[]).includes(pa as string) ? [pa as string] : [];
                    } else if (!Array.isArray(ua) && Array.isArray(pa) && ua) {
                      shared = (pa as string[]).includes(ua as string) ? [ua as string] : [];
                    } else if (ua && pa && ua === pa) {
                      shared = [ua as string];
                    }
                    return shared.map((s) => (
                      <span key={`winner-${q.id}-${s}`} className="text-xs bg-pink-100 border border-pink-300 rounded-full px-2 py-1">
                        {s}
                      </span>
                    ));
                  })}
                </div>
              </div>
            </div>

            {/* Other matches */}
            {matches.length > 1 && (
              <>
                <h3 className="text-lg font-semibold mb-2 text-slate-600 text-center">Other Good Matches</h3>
                <div className="space-y-3">
                  {matches.slice(1).map((m) => {
                    const score = Math.round(m.score * 100);
                    return (
                      <div key={m.id} className="flex items-center gap-4 border rounded-lg p-3 bg-white/80">
                        <img src={m.avatar} alt={m.name} className="w-12 h-12 rounded-full object-cover" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{m.name}</div>
                              <div className="text-sm text-slate-500">{m.bio}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-400">Compatibility</div>
                              <div className="font-semibold text-sky-600">{score}%</div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-1">
                            {QUESTIONS.map((q) => {
                              const ua = answers[q.id];
                              const pa = m.answers[q.id];
                              let shared: string[] = [];
                              if (Array.isArray(ua) && Array.isArray(pa)) {
                                shared = (ua as string[]).filter((x) => (pa as string[]).includes(x));
                              } else if (Array.isArray(ua) && !Array.isArray(pa) && pa) {
                                shared = (ua as string[]).includes(pa as string) ? [pa as string] : [];
                              } else if (!Array.isArray(ua) && Array.isArray(pa) && ua) {
                                shared = (pa as string[]).includes(ua as string) ? [ua as string] : [];
                              } else if (ua && pa && ua === pa) {
                                shared = [ua as string];
                              }
                              return shared.map((s) => (
                                <span key={`${m.id}-${q.id}-${s}`} className="bg-slate-100 border rounded-full px-2 py-1">
                                  {s}
                                </span>
                              ));
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-8 flex justify-center">
              <button onClick={reset} className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-400 to-sky-400 text-white font-bold shadow hover:from-pink-500 hover:to-sky-500 transition">
                Try Again
              </button>
            </div>
          </section>
        )}

        <footer className="mt-6 text-xs text-slate-400">
          Demo algorithm: cosine similarity on one-hot vectors + exact-answer bonus.
        </footer>
      </div>
    </div>
  );
}
