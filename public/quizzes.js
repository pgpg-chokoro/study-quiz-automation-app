const labelMaps = {
  difficulty: {
    beginner: "初級",
    intermediate: "中級",
    advanced: "上級",
    expert: "超上級"
  },
  type: {
    "multiple-choice": "選択式",
    "true-false": "○×式",
    "fill-blank": "穴埋め",
    "short-answer": "短答式"
  },
  actionType: {
    create: "新規作成",
    expand: "追加",
    improve: "改善"
  }
};

const initialParams = new URLSearchParams(window.location.search);
const state = {
  quizHistory: [],
  selectedGenreId: initialParams.get("genre") ?? "",
  selectedSetId: initialParams.get("set") ?? "",
  difficultyFilter: "all",
  actionFilter: "all",
  answers: new Map()
};

const elements = {
  quizError: document.querySelector("#quiz-error"),
  quizContent: document.querySelector("#quiz-content"),
  quizCount: document.querySelector("#quiz-count"),
  difficultyFilter: document.querySelector("#difficulty-filter"),
  actionFilter: document.querySelector("#action-filter"),
  refreshButton: document.querySelector("#refresh-button")
};

function createElement(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === false) {
      continue;
    }

    if (key === "className") {
      node.className = value;
    } else if (key === "text") {
      node.textContent = value;
    } else {
      node.setAttribute(key, value);
    }
  }

  for (const child of children) {
    node.append(child);
  }

  return node;
}

function showMessage(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderBadge(text, className = "") {
  return createElement("span", {
    className: ("badge " + className).trim(),
    text
  });
}

async function fetchQuizHistory() {
  const response = await fetch(window.QUIZ_HISTORY_URL ?? "/api/quizzes", {
    headers: { "content-type": "application/json" }
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "クイズ履歴の取得に失敗しました。");
  }

  return Array.isArray(payload) ? payload : payload.quizHistory ?? [];
}

async function loadData() {
  showMessage(elements.quizError, "");
  state.quizHistory = await fetchQuizHistory();
  render();
}

function getQuestionKey(quizSet, question) {
  return quizSet.id + ":" + question.id;
}

function getSetDate(quizSet) {
  return new Date(quizSet.updatedAt ?? quizSet.createdAt ?? 0).getTime();
}

function getGenreId(quizSet) {
  return quizSet.sourceTopicIds?.[0] ?? "unknown";
}

function getGenreLabel(quizSet) {
  return quizSet.topicLabels?.[0] ?? quizSet.topicLabel ?? getGenreId(quizSet);
}

function getQuestionCount(quizSets) {
  return quizSets.reduce((sum, quizSet) => sum + (quizSet.questions?.length ?? 0), 0);
}

function getFilteredQuestions(quizSet) {
  return (quizSet.questions ?? []).filter(
    (question) => state.difficultyFilter === "all" || question.difficulty === state.difficultyFilter
  );
}

function getFilteredSets() {
  return state.quizHistory
    .filter((quizSet) => state.actionFilter === "all" || quizSet.actionType === state.actionFilter)
    .map((quizSet) => ({
      ...quizSet,
      questions: getFilteredQuestions(quizSet)
    }))
    .filter((quizSet) => quizSet.questions.length > 0)
    .sort((a, b) => getSetDate(b) - getSetDate(a));
}

function getGenreGroups() {
  const groups = new Map();

  for (const quizSet of getFilteredSets()) {
    const genreId = getGenreId(quizSet);
    if (!groups.has(genreId)) {
      groups.set(genreId, {
        id: genreId,
        label: getGenreLabel(quizSet),
        sets: [],
        questionCount: 0,
        latestAt: 0,
        difficulties: new Set(),
        actionTypes: new Set()
      });
    }

    const group = groups.get(genreId);
    group.sets.push(quizSet);
    group.questionCount += quizSet.questions.length;
    group.latestAt = Math.max(group.latestAt, getSetDate(quizSet));
    group.actionTypes.add(quizSet.actionType);
    for (const question of quizSet.questions) {
      group.difficulties.add(question.difficulty);
    }
  }

  return [...groups.values()].sort((a, b) => b.latestAt - a.latestAt);
}

function getGenreData(genreId) {
  const sets = getFilteredSets().filter((quizSet) => getGenreId(quizSet) === genreId);
  const questionItems = [];

  for (const quizSet of sets) {
    for (const question of quizSet.questions ?? []) {
      questionItems.push({ quizSet, question });
    }
  }

  return { sets, questionItems };
}

function updateUrl(next, pushHistory = true) {
  const url = new URL(window.location.href);
  url.searchParams.delete("genre");
  url.searchParams.delete("set");

  if (next.genre) {
    url.searchParams.set("genre", next.genre);
  }

  if (next.set) {
    url.searchParams.set("set", next.set);
  }

  if (pushHistory) {
    window.history.pushState({}, "", url);
  }
}

function selectGenre(genreId, pushHistory = true) {
  state.selectedGenreId = genreId;
  state.selectedSetId = "";
  updateUrl({ genre: genreId }, pushHistory);
  render();
}

function selectSet(setId, pushHistory = true) {
  state.selectedSetId = setId;
  state.selectedGenreId = "";
  updateUrl({ set: setId }, pushHistory);
  render();
}

function clearSelection() {
  state.selectedGenreId = "";
  state.selectedSetId = "";
  updateUrl({});
  render();
}

function getSortedBadges(values, map) {
  return [...values].filter(Boolean).map((value) => renderBadge(map[value] ?? value));
}

function renderHistoryPanel(quizSets) {
  const details = createElement("details", { className: "history-panel" });
  details.append(createElement("summary", { text: "追加日・追加理由" }));

  const list = createElement("div", { className: "history-list" });
  for (const quizSet of quizSets) {
    const meta = [
      renderBadge(labelMaps.actionType[quizSet.actionType] ?? quizSet.actionType),
      createElement("span", { text: "追加日: " + formatDate(quizSet.createdAt) })
    ];

    if (quizSet.improvedFromQuizSetId) {
      meta.push(createElement("span", { text: "改善元: " + quizSet.improvedFromQuizSetId }));
    }

    const children = [
      createElement("h3", { text: quizSet.title }),
      createElement("div", { className: "quiz-meta" }, meta)
    ];

    if (quizSet.generationReason) {
      children.push(createElement("p", { className: "quiz-reason", text: quizSet.generationReason }));
    }

    list.append(createElement("article", { className: "history-item" }, children));
  }

  details.append(list);
  return details;
}

function renderGenreList() {
  const groups = getGenreGroups();
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent =
    groups.length + "ジャンル / " + state.quizHistory.length + "セット / " + getQuestionCount(state.quizHistory) + "問";

  if (state.quizHistory.length === 0) {
    elements.quizContent.append(
      createElement("p", {
        className: "empty",
        text: "クイズ履歴はまだありません。"
      })
    );
    return;
  }

  if (groups.length === 0) {
    elements.quizContent.append(
      createElement("p", {
        className: "empty",
        text: "条件に一致するジャンルがありません。"
      })
    );
    return;
  }

  const list = createElement("div", { className: "genre-list" });

  for (const group of groups) {
    const answerLink = createElement("a", {
      className: "primary-button inline-link",
      href: "quizzes.html?genre=" + encodeURIComponent(group.id),
      text: "このジャンルを回答"
    });
    answerLink.addEventListener("click", (event) => {
      event.preventDefault();
      selectGenre(group.id);
    });

    list.append(
      createElement("article", { className: "genre-card" }, [
        createElement("h3", { text: group.label }),
        createElement("div", { className: "quiz-meta" }, [
          createElement("span", { text: group.sets.length + "セット" }),
          createElement("span", { text: group.questionCount + "問" }),
          createElement("span", { text: "最終追加: " + formatDate(group.latestAt) })
        ]),
        createElement("div", { className: "question-meta" }, [
          ...getSortedBadges(group.difficulties, labelMaps.difficulty),
          ...getSortedBadges(group.actionTypes, labelMaps.actionType)
        ]),
        createElement("div", { className: "item-actions" }, [answerLink])
      ])
    );
  }

  elements.quizContent.append(list);
}

function normalizeAnswer(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function judgeAnswer(question, value) {
  return normalizeAnswer(value) === normalizeAnswer(question.answer);
}

function storeAnswer(quizSet, question, value) {
  const key = getQuestionKey(quizSet, question);
  state.answers.set(key, {
    value,
    correct: judgeAnswer(question, value)
  });
}

function updateSetProgress(quizSet) {
  updateProgress(
    (quizSet.questions ?? []).map((question) => ({ quizSet, question })),
    quizSet.questions?.length ?? 0
  );
}

function updateProgress(questionItems, totalCount = questionItems.length) {
  const progress = document.querySelector("#quiz-progress");
  if (!progress) {
    return;
  }

  const results = questionItems
    .map(({ quizSet, question }) => state.answers.get(getQuestionKey(quizSet, question)))
    .filter(Boolean);
  const correctCount = results.filter((result) => result.correct).length;
  progress.textContent = "回答済み " + results.length + "/" + totalCount + "問 / 正解 " + correctCount + "問";
}

function renderFeedback(question, result) {
  if (!result) {
    return createElement("p", { className: "answer-result pending", text: "未回答" });
  }

  const children = [
    createElement("p", {
      className: result.correct ? "answer-result correct" : "answer-result wrong",
      text: result.correct ? "正解" : "不正解"
    })
  ];

  if (!result.correct) {
    children.push(createElement("p", { className: "answer-text", text: "正答: " + question.answer }));
  }

  if (question.explanation) {
    children.push(createElement("p", { className: "explanation", text: question.explanation }));
  }

  return createElement("div", { className: "answer-feedback" }, children);
}

function renderChoiceQuestion(quizSet, question, result, resultNode, onAnswered) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const list = createElement("div", { className: "choice-grid" });

  for (const choice of choices) {
    const button = createElement("button", {
      className: "choice-button",
      type: "button",
      text: choice
    });

    if (result && result.value === choice) {
      button.classList.add(result.correct ? "selected-correct" : "selected-wrong");
      button.setAttribute("aria-pressed", "true");
    }

    button.addEventListener("click", () => {
      storeAnswer(quizSet, question, choice);
      const latest = state.answers.get(getQuestionKey(quizSet, question));

      for (const sibling of list.querySelectorAll(".choice-button")) {
        sibling.classList.remove("selected-correct", "selected-wrong");
        sibling.setAttribute("aria-pressed", "false");
      }

      button.classList.add(latest.correct ? "selected-correct" : "selected-wrong");
      button.setAttribute("aria-pressed", "true");
      resultNode.replaceChildren(renderFeedback(question, latest));
      onAnswered();
    });

    list.append(button);
  }

  return list;
}

function renderTextQuestion(quizSet, question, result, resultNode, onAnswered) {
  const wrapper = createElement("div", { className: "text-answer" });
  const input = createElement("input", {
    type: "text",
    value: result?.value ?? "",
    "aria-label": "回答"
  });
  const button = createElement("button", {
    className: "primary-button",
    type: "button",
    text: "判定"
  });

  button.addEventListener("click", () => {
    storeAnswer(quizSet, question, input.value);
    resultNode.replaceChildren(renderFeedback(question, state.answers.get(getQuestionKey(quizSet, question))));
    onAnswered();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      button.click();
    }
  });

  wrapper.append(input, button);
  return wrapper;
}

function renderQuestion(quizSet, question, index, options = {}) {
  const key = getQuestionKey(quizSet, question);
  const result = state.answers.get(key);
  const resultNode = createElement("div", { className: "result-slot" }, [renderFeedback(question, result)]);
  const type = question.type ?? "multiple-choice";
  const headerChildren = [
    createElement("span", { className: "question-number", text: "Q" + (index + 1) }),
    renderBadge(labelMaps.difficulty[question.difficulty] ?? question.difficulty),
    renderBadge(labelMaps.type[type] ?? type)
  ];

  if (options.contextLabel) {
    headerChildren.push(renderBadge(options.contextLabel, "source-badge"));
  }

  const onAnswered = options.onAnswered ?? (() => updateSetProgress(quizSet));
  const children = [
    createElement("div", { className: "question-header" }, headerChildren),
    createElement("p", { className: "question-prompt", text: question.prompt }),
    resultNode
  ];

  if (type === "multiple-choice" || type === "true-false") {
    children.push(renderChoiceQuestion(quizSet, question, result, resultNode, onAnswered));
  } else {
    children.push(renderTextQuestion(quizSet, question, result, resultNode, onAnswered));
  }

  return createElement("article", { className: "question-card" }, children);
}

function renderBackButton() {
  const backButton = createElement("button", {
    className: "secondary-button",
    type: "button",
    text: "ジャンル一覧に戻る"
  });
  backButton.addEventListener("click", clearSelection);
  return backButton;
}

function renderSelectedGenre(genreId) {
  const { sets, questionItems } = getGenreData(genreId);
  const label = sets[0] ? getGenreLabel(sets[0]) : genreId;
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent = label + " / " + sets.length + "セット / " + questionItems.length + "問";

  const header = createElement("div", { className: "selected-quiz-header" }, [
    createElement("div", {}, [
      createElement("h2", { text: label }),
      createElement("p", {
        id: "quiz-progress",
        className: "quiz-meta",
        text: "回答済み 0/" + questionItems.length + "問 / 正解 0問"
      })
    ]),
    renderBackButton()
  ]);

  const questionList = createElement(
    "div",
    { className: "question-list" },
    questionItems.map(({ quizSet, question }, index) =>
      renderQuestion(quizSet, question, index, {
        contextLabel: quizSet.title,
        onAnswered: () => updateProgress(questionItems)
      })
    )
  );

  if (questionItems.length === 0) {
    questionList.append(
      createElement("p", {
        className: "empty",
        text: "この条件で表示できる問題がありません。"
      })
    );
  }

  elements.quizContent.append(
    createElement("section", { className: "selected-quiz" }, [
      header,
      renderHistoryPanel(sets),
      questionList
    ])
  );
  updateProgress(questionItems);
}

function renderSelectedSet(quizSet) {
  const filteredQuestions = getFilteredQuestions(quizSet);
  const filteredSet = { ...quizSet, questions: filteredQuestions };
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent = quizSet.title + " / " + filteredQuestions.length + "問";

  const header = createElement("div", { className: "selected-quiz-header" }, [
    createElement("div", {}, [
      createElement("h2", { text: quizSet.title }),
      createElement("p", {
        id: "quiz-progress",
        className: "quiz-meta",
        text: "回答済み 0/" + filteredQuestions.length + "問 / 正解 0問"
      })
    ]),
    renderBackButton()
  ]);

  const questionList = createElement(
    "div",
    { className: "question-list" },
    filteredQuestions.map((question, index) => renderQuestion(filteredSet, question, index))
  );

  if (filteredQuestions.length === 0) {
    questionList.append(
      createElement("p", {
        className: "empty",
        text: "この条件で表示できる問題がありません。"
      })
    );
  }

  elements.quizContent.append(
    createElement("section", { className: "selected-quiz" }, [
      header,
      renderHistoryPanel([quizSet]),
      questionList
    ])
  );
  updateSetProgress(filteredSet);
}

function render() {
  const selectedSet = state.quizHistory.find((quizSet) => quizSet.id === state.selectedSetId);

  if (state.selectedSetId && selectedSet) {
    renderSelectedSet(selectedSet);
    return;
  }

  if (state.selectedGenreId) {
    renderSelectedGenre(state.selectedGenreId);
    return;
  }

  if (state.selectedSetId && !selectedSet) {
    state.selectedSetId = "";
  }

  renderGenreList();
}

elements.refreshButton.addEventListener("click", () => {
  loadData().catch((error) => showMessage(elements.quizError, error.message));
});
elements.difficultyFilter.addEventListener("change", (event) => {
  state.difficultyFilter = event.target.value;
  render();
});
elements.actionFilter.addEventListener("change", (event) => {
  state.actionFilter = event.target.value;
  render();
});
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  state.selectedGenreId = params.get("genre") ?? "";
  state.selectedSetId = params.get("set") ?? "";
  render();
});

loadData().catch((error) => {
  showMessage(elements.quizError, error.message);
});
