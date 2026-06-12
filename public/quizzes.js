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
    create: "初回セット",
    expand: "新規観点",
    improve: "改善版"
  }
};

const actionDescriptions = {
  create: "このジャンルの初回生成",
  expand: "未出題テーマを追加",
  improve: "既存問題を改善"
};

const choiceLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const initialParams = new URLSearchParams(window.location.search);
const state = {
  quizHistory: [],
  selectedGenreId: initialParams.get("genre") ?? "",
  selectedSetId: initialParams.get("set") ?? "",
  difficultyFilter: "all",
  actionFilter: "all",
  currentQuestionIndex: 0,
  answers: new Map()
};

const elements = {
  quizError: document.querySelector("#quiz-error"),
  quizContent: document.querySelector("#quiz-content"),
  quizCount: document.querySelector("#quiz-count"),
  difficultyFilter: document.querySelector("#difficulty-filter"),
  actionFilter: document.querySelector("#action-filter"),
  resetFiltersButton: document.querySelector("#reset-filters-button"),
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

function formatPercent(correctCount, answeredCount) {
  if (answeredCount === 0) {
    return "0%";
  }

  return Math.round((correctCount / answeredCount) * 100) + "%";
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

function hasActiveFilters() {
  return state.difficultyFilter !== "all" || state.actionFilter !== "all";
}

function syncFilterControls() {
  elements.difficultyFilter.value = state.difficultyFilter;
  elements.actionFilter.value = state.actionFilter;

  if (elements.resetFiltersButton) {
    elements.resetFiltersButton.disabled = !hasActiveFilters();
  }
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
  state.currentQuestionIndex = 0;
  updateUrl({ genre: genreId }, pushHistory);
  render();
}

function selectSet(setId, pushHistory = true) {
  state.selectedSetId = setId;
  state.selectedGenreId = "";
  state.currentQuestionIndex = 0;
  updateUrl({ set: setId }, pushHistory);
  render();
}

function clearSelection() {
  state.selectedGenreId = "";
  state.selectedSetId = "";
  state.currentQuestionIndex = 0;
  updateUrl({});
  render();
}

function getSortedBadges(values, map) {
  return [...values].filter(Boolean).map((value) => renderBadge(map[value] ?? value));
}

function renderStat(value, label) {
  return createElement("div", { className: "stat-box" }, [
    createElement("strong", { text: value }),
    createElement("span", { text: label })
  ]);
}

function renderHistoryPanel(quizSets) {
  const details = createElement("details", { className: "history-panel" });
  details.append(createElement("summary", { text: "追加日・追加理由" }));

  const list = createElement("div", { className: "history-list" });
  for (const quizSet of quizSets) {
    const meta = [
      renderBadge(labelMaps.actionType[quizSet.actionType] ?? quizSet.actionType),
      createElement("span", { text: actionDescriptions[quizSet.actionType] ?? "作成目的未設定" }),
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
  const filteredSetCount = groups.reduce((sum, group) => sum + group.sets.length, 0);
  const filteredQuestionCount = groups.reduce((sum, group) => sum + group.questionCount, 0);
  const filterText = hasActiveFilters() ? " / 絞り込み中" : "";
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent =
    groups.length + "ジャンル / " + filteredSetCount + "セット / " + filteredQuestionCount + "問" + filterText;

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
      text: "回答する"
    });
    answerLink.addEventListener("click", (event) => {
      event.preventDefault();
      selectGenre(group.id);
    });

    list.append(
      createElement("article", { className: "genre-card" }, [
        createElement("div", { className: "genre-card-header" }, [
          createElement("div", {}, [
            createElement("p", { className: "card-kicker", text: "ジャンル" }),
            createElement("h3", { text: group.label })
          ])
        ]),
        createElement("div", { className: "genre-stats" }, [
          renderStat(String(group.questionCount), "問題"),
          renderStat(String(group.sets.length), "セット")
        ]),
        createElement("p", { className: "latest-label", text: "最終追加: " + formatDate(group.latestAt) }),
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
  progress.textContent =
    "回答済み " +
    results.length +
    "/" +
    totalCount +
    "問 / 正解 " +
    correctCount +
    "問 / 正答率 " +
    formatPercent(correctCount, results.length);

  const progressBar = document.querySelector("#quiz-progress-bar");
  if (progressBar) {
    const answeredPercent = totalCount === 0 ? 0 : Math.round((results.length / totalCount) * 100);
    progressBar.style.width = answeredPercent + "%";
  }

  const position = document.querySelector("#question-position");
  if (position) {
    const currentNumber = totalCount === 0 ? 0 : state.currentQuestionIndex + 1;
    position.textContent = "Q" + currentNumber + " / " + totalCount + " / 回答済み " + results.length + "問";
  }
}

function renderFeedback(question, result) {
  if (!result) {
    return document.createDocumentFragment();
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

  return createElement("div", { className: "answer-feedback", role: "status" }, children);
}

function renderChoiceQuestion(quizSet, question, result, resultNode, onAnswered) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const list = createElement("div", { className: "choice-grid" });

  choices.forEach((choice, choiceIndex) => {
    const button = createElement("button", {
      className: "choice-button",
      type: "button",
      "aria-pressed": "false"
    }, [
      createElement("span", { className: "choice-marker", text: choiceLabels[choiceIndex] ?? String(choiceIndex + 1) }),
      createElement("span", { className: "choice-text", text: choice })
    ]);

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
  });

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
    createElement("p", { className: "question-prompt", text: question.prompt })
  ];

  if (type === "multiple-choice" || type === "true-false") {
    children.push(renderChoiceQuestion(quizSet, question, result, resultNode, onAnswered));
  } else {
    children.push(renderTextQuestion(quizSet, question, result, resultNode, onAnswered));
  }

  children.push(resultNode);
  return createElement("article", { className: "question-card", tabindex: "-1", "data-current-question": "true" }, children);
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

function clampQuestionIndex(totalCount) {
  const maxIndex = Math.max(totalCount - 1, 0);
  state.currentQuestionIndex = Math.min(Math.max(state.currentQuestionIndex, 0), maxIndex);
}

function setCurrentQuestion(index, totalCount) {
  clampQuestionIndex(totalCount);
  state.currentQuestionIndex = Math.min(Math.max(index, 0), Math.max(totalCount - 1, 0));
  render();
  requestAnimationFrame(() => {
    document.querySelector("[data-current-question]")?.focus();
  });
}

function renderQuestionNavigation(questionItems) {
  const totalCount = questionItems.length;
  const answeredCount = questionItems
    .map(({ quizSet, question }) => state.answers.get(getQuestionKey(quizSet, question)))
    .filter(Boolean).length;
  const currentNumber = totalCount === 0 ? 0 : state.currentQuestionIndex + 1;
  const previousButton = createElement("button", {
    className: "secondary-button",
    type: "button",
    text: "前へ",
    disabled: state.currentQuestionIndex <= 0
  });
  const nextButton = createElement("button", {
    className: "primary-button",
    type: "button",
    text: "次へ",
    disabled: totalCount === 0 || state.currentQuestionIndex >= totalCount - 1
  });

  previousButton.addEventListener("click", () => setCurrentQuestion(state.currentQuestionIndex - 1, totalCount));
  nextButton.addEventListener("click", () => setCurrentQuestion(state.currentQuestionIndex + 1, totalCount));

  return createElement("nav", { className: "question-nav", "aria-label": "問題ナビゲーション" }, [
    previousButton,
    createElement("p", {
      id: "question-position",
      className: "question-position",
      text: "Q" + currentNumber + " / " + totalCount + " / 回答済み " + answeredCount + "問"
    }),
    nextButton
  ]);
}

function renderQuizHeader(title, totalCount, backButton) {
  return createElement("div", { className: "selected-quiz-header" }, [
    createElement("div", { className: "selected-title" }, [
      createElement("p", { className: "card-kicker", text: "回答中" }),
      createElement("h2", { text: title })
    ]),
    createElement("div", { className: "progress-panel" }, [
      createElement("span", { className: "progress-label", text: "進捗" }),
      createElement("p", {
        id: "quiz-progress",
        className: "quiz-meta",
        text: "回答済み 0/" + totalCount + "問 / 正解 0問 / 正答率 0%"
      }),
      createElement("div", { className: "progress-track", "aria-hidden": "true" }, [
        createElement("span", { id: "quiz-progress-bar", className: "progress-fill", style: "width: 0%" })
      ])
    ]),
    backButton
  ]);
}

function renderSelectedGenre(genreId) {
  const { sets, questionItems } = getGenreData(genreId);
  const label = sets[0] ? getGenreLabel(sets[0]) : genreId;
  clampQuestionIndex(questionItems.length);
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent = label + " / " + sets.length + "セット / " + questionItems.length + "問";

  const header = renderQuizHeader(label, questionItems.length, renderBackButton());
  const questionList = createElement("div", { className: "question-list" });
  const currentItem = questionItems[state.currentQuestionIndex];

  if (currentItem) {
    questionList.append(
      renderQuestion(currentItem.quizSet, currentItem.question, state.currentQuestionIndex, {
        contextLabel: currentItem.quizSet.title,
        onAnswered: () => updateProgress(questionItems)
      })
    );
  } else {
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
      questionList,
      renderQuestionNavigation(questionItems)
    ])
  );
  updateProgress(questionItems);
}

function renderSelectedSet(quizSet) {
  const filteredQuestions = getFilteredQuestions(quizSet);
  const filteredSet = { ...quizSet, questions: filteredQuestions };
  const questionItems = filteredQuestions.map((question) => ({ quizSet: filteredSet, question }));
  clampQuestionIndex(filteredQuestions.length);
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent = quizSet.title + " / " + filteredQuestions.length + "問";

  const header = renderQuizHeader(quizSet.title, filteredQuestions.length, renderBackButton());
  const questionList = createElement("div", { className: "question-list" });
  const currentQuestion = filteredQuestions[state.currentQuestionIndex];

  if (currentQuestion) {
    questionList.append(renderQuestion(filteredSet, currentQuestion, state.currentQuestionIndex));
  } else {
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
      questionList,
      renderQuestionNavigation(questionItems)
    ])
  );
  updateSetProgress(filteredSet);
}

function render() {
  syncFilterControls();
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
  state.currentQuestionIndex = 0;
  render();
});
elements.actionFilter.addEventListener("change", (event) => {
  state.actionFilter = event.target.value;
  state.currentQuestionIndex = 0;
  render();
});
elements.resetFiltersButton?.addEventListener("click", () => {
  state.difficultyFilter = "all";
  state.actionFilter = "all";
  state.currentQuestionIndex = 0;
  render();
});
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  state.selectedGenreId = params.get("genre") ?? "";
  state.selectedSetId = params.get("set") ?? "";
  state.currentQuestionIndex = 0;
  render();
});

loadData().catch((error) => {
  showMessage(elements.quizError, error.message);
});
