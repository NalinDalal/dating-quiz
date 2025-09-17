import React, { useState, useEffect, useMemo } from "react";

// Demo: Quiz -> Countdown -> Matching
// Single-file React component (Next.js / Create React App compatible)
// Tailwind classes used for styling.

// --- Configuration ---------------------------------------------------------
const QUESTIONS = [
  {
    id: "q1",
    text: "What's your ideal weekend activity?",
    type: "single",
    options: [
      "Hiking / Outdoors",
      "Movie / Chill",
      "Party / Social",
      "Reading / Cozy",
    ],
  },
  {
    id: "q2",
    text: "Pick a favorite cuisine",
    type: "single",
    options: ["Italian", "Indian", "Japanese", "Mexican"],
  },
  {
    id: "q3",
    text: "Which vibe draws you to someone?",
    type: "single",
    options: ["Humorous", "Intellectual", "Adventurous", "Calm"],
  },
  {
    id: "q4",
    text: "Choose a hobby you enjoy",
    type: "multi",
    options: ["Cooking", "Gaming", "Sports", "Art / Music"],
  },
];

// Example "database" of profiles. In a real app you'd fetch these from a backend.
const PROFILES = [
  {
    id: "alice",
    name: "Alice",
    bio: "Loves trails, spicy food and painting.",
    answers: {
      q1: "Hiking / Outdoors",
      q2: "Indian",
      q3: "Adventurous",
      q4: ["Art / Music", "Cooking"],
    },
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "bob",
    name: "Bob",
    bio: "Movie buff and home chef.",
    answers: {
      q1: "Movie / Chill",
      q2: "Italian",
      q3: "Humorous",
      q4: ["Cooking", "Gaming"],
    },
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  {
    id: "carla",
    name: "Carla",
    bio: "Books, calm walks and sushi dates.",
    answers: {
      q1: "Reading / Cozy",
      q2: "Japanese",
      q3: "Calm",
      q4: ["Art / Music"],
    },
    avatar: "https://i.pravatar.cc/150?img=22",
  },
  {
    id: "dan",
    name: "Dan",
    bio: "You’ll find me at a party or a futsal game.",
    answers: {
      q1: "Party / Social",
      q2: "Mexican",
      q3: "Adventurous",
      q4: ["Sports", "Gaming"],
    },
    avatar: "https://i.pravatar.cc/150?img=32",
  },
];

// ----------------- Utility: Vectorize answers -------------------------------
// We'll convert answers to a numeric vector (one-hot / multi-hot) where each option
// across all questions is a feature. Then compute cosine similarity between users.

function buildFeatureMap(questions) {
  const map = {};
  let idx = 0;
  for (const q of questions) {
    for (const opt of q.options) {
      map[`${q.id}::${opt}`] = idx++;
    }
  }
  return { map, length: idx };
}

function answersToVector(answers, featureMapLength, featureMap) {
  const vec = new Array(featureMapLength).fill(0);
  for (const key of Object.keys(answers)) {
    const val = answers[key];
    if (Array.isArray(val)) {
      for (const v of val) {
        const k = `${key}::${v}`;
        if (k in featureMap) vec[featureMap[k]] = 1;
      }
    } else {
      const k = `${key}::${val}`;
      if (k in featureMap) vec[featureMap[k]] = 1;
    }
  }
  return vec;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

function cosineSim(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

// ----------------- Main Component -------------------------------------------
export default function QuizMatchDemo() {
  // feature map is computed from QUESTIONS
  const { map: featureMap, length: featureLen } = useMemo(
    () => buildFeatureMap(QUESTIONS),
    [],
  );

  const [answers, setAnswers] = useState(() => {
    const initial = {};
    for (const q of QUESTIONS) {
      initial[q.id] = q.type === "multi" ? [] : null;
    }
    return initial;
  });

  const [step, setStep] = useState("quiz"); // quiz | counting | results
  const [count, setCount] = useState(5);
  const [matches, setMatches] = useState([]);
  const [processingText, setProcessingText] = useState("Analyzing answers...");

  // Helper: toggle multi answers
  function toggleAnswer(qid, opt) {
    setAnswers((prev) => {
      const cur = prev[qid];
      const q = QUESTIONS.find((x) => x.id === qid);
      if (q.type === "multi") {
        const setCur = new Set(cur || []);
        if (setCur.has(opt)) setCur.delete(opt);
        else setCur.add(opt);
        return { ...prev, [qid]: Array.from(setCur) };
      } else {
        return { ...prev, [qid]: opt };
      }
    });
  }

  // Start countdown when user finishes quiz
  function startCountdown() {
    setStep("counting");
    setCount(5);
    setProcessingText("Analyzing answers...");
  }

  // Countdown effect
  useEffect(() => {
    if (step !== "counting") return;
    if (count <= 0) {
      // run matching
      runMatching();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 900);
    return () => clearTimeout(id);
  }, [step, count]);

  // The matching algorithm
  function runMatching() {
    setProcessingText("Computing compatibility...");

    // Convert current user answers to vector
    const userVec = answersToVector(answers, featureLen, featureMap);

    // Score each profile
    const scored = PROFILES.map((p) => {
      const pVec = answersToVector(p.answers, featureLen, featureMap);
      const sim = cosineSim(userVec, pVec);
      // final score tweaks: encourage profiles with at least one exact match per question
      let exactMatches = 0;
      for (const q of QUESTIONS) {
        const ua = answers[q.id];
        const pa = p.answers[q.id];
        if (Array.isArray(ua) && Array.isArray(pa)) {
          if (ua.some((x) => pa.includes(x))) exactMatches++;
        } else if (Array.isArray(ua) && !Array.isArray(pa)) {
          if (ua.includes(pa)) exactMatches++;
        } else if (!Array.isArray(ua) && Array.isArray(pa)) {
          if (pa.includes(ua)) exactMatches++;
        } else {
          if (ua === pa) exactMatches++;
        }
      }
      const bonus = (exactMatches / QUESTIONS.length) * 0.15; // up to +0.15
      const finalScore = Math.min(1, sim + bonus);
      return { ...p, score: finalScore };
    });

    // sort by score descending
    scored.sort((a, b) => b.score - a.score);
    setMatches(scored);
    setStep("results");
  }

  // Reset
  function reset() {
    setAnswers(() => {
      const initial = {};
      for (const q of QUESTIONS) initial[q.id] = q.type === "multi" ? [] : null;
      return initial;
    });
    setMatches([]);
    setStep("quiz");
  }

  // Validation: ensure every single-choice question has an answer
  const incomplete = QUESTIONS.some(
    (q) => q.type === "single" && !answers[q.id],
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Quiz → Countdown → Match</h1>
          <button
            onClick={reset}
            className="text-sm text-slate-500 hover:underline"
          >
            Reset
          </button>
        </header>

        {step === "quiz" && (
          <section>
            <p className="mb-4 text-slate-600">
              Answer the quick quiz — we’ll match you after the countdown.
            </p>

            <div className="space-y-6">
              {QUESTIONS.map((q) => (
                <div key={q.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{q.text}</h3>
                    <span className="text-sm text-slate-500">
                      {q.type === "multi" ? "Choose any" : "Choose one"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {q.options.map((opt) => {
                      const selected = Array.isArray(answers[q.id])
                        ? answers[q.id].includes(opt)
                        : answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => toggleAnswer(q.id, opt)}
                          className={
                            `p-3 text-left rounded-lg border hover:shadow-sm transition ` +
                            (selected
                              ? "bg-sky-100 border-sky-300 "
                              : "bg-white border-slate-200")
                          }
                        >
                          <div className="text-sm font-medium">{opt}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Tip: the algorithm favors shared preferences and exact matches.
              </div>
              <div>
                <button
                  onClick={startCountdown}
                  disabled={incomplete}
                  className={`px-4 py-2 rounded-lg text-white font-medium shadow-sm ${incomplete ? "bg-slate-300 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-700"}`}
                >
                  Start Countdown
                </button>
              </div>
            </div>
          </section>
        )}

        {step === "counting" && (
          <section className="text-center py-12">
            <div className="text-6xl font-bold mb-4 animate-pulse">{count}</div>
            <div className="text-slate-600 mb-6">{processingText}</div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-width"
                style={{ width: `${((5 - count) / 5) * 100}%` }}
              />
            </div>
          </section>
        )}

        {step === "results" && (
          <section>
            <h2 className="text-xl font-semibold mb-3">Matches</h2>
            <p className="text-sm text-slate-500 mb-4">
              Top matches based on your quiz answers.
            </p>

            <div className="space-y-3">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-4 border rounded-lg p-3"
                >
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-sm text-slate-500">{m.bio}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">
                          Compatibility
                        </div>
                        <div className="font-semibold">
                          {Math.round(m.score * 100)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-slate-600">
                      <div className="text-xs text-slate-400">
                        Shared answers:
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {QUESTIONS.map((q) => {
                          const ua = answers[q.id];
                          const pa = m.answers[q.id];
                          let shared = [];
                          if (Array.isArray(ua) && Array.isArray(pa))
                            shared = ua.filter((x) => pa.includes(x));
                          else if (Array.isArray(ua) && !Array.isArray(pa))
                            shared = ua.includes(pa) ? [pa] : [];
                          else if (!Array.isArray(ua) && Array.isArray(pa))
                            shared = pa.includes(ua) ? [ua] : [];
                          else if (ua === pa) shared = [ua];

                          return shared.map((s) => (
                            <span
                              key={`${m.id}-${q.id}-${s}`}
                              className="text-xs bg-slate-100 border rounded-full px-2 py-1"
                            >
                              {s}
                            </span>
                          ));
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200"
              >
                Try again
              </button>
            </div>
          </section>
        )}

        <footer className="mt-6 text-xs text-slate-400">
          Demo algorithm: cosine similarity on one-hot vectors + exact-answer
          bonus.
        </footer>
      </div>
    </div>
  );
}
