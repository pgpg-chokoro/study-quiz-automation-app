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

const state = {
  quizHistory: [],
  selectedSetId: new URLSearchParams(window.location.search).get("set") ?? "",
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

function getFilteredSets() {
  return state.quizHistory
    .filter((quizSet) => state.actionFilter === "all" || quizSet.actionType === state.actionFilter)
    .map((quizSet) => ({
      ...quizSet,
      questions: (quizSet.questions ?? []).filter(
        (question) => state.difficultyFilter === "all" || question.difficulty === state.difficultyFilter
      )
    }))
    .filter((quizSet) => quizSet.questions.length > 0)
    .sort((a, b) => {
      const dateA = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const dateB = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return dateB - dateA;
    });
}

function selectSet(setId, pushHistory = true) {
  state.selectedSetId = setId;
  const url = new URL(window.location.href);

  if (setId) {
    url.searchParams.set("set", setId);
  } else {
    url.searchParams.delete("set");
  }

  if (pushHistory) {
    window.history.pushState({}, "", url);
  }

  render();
}

function getDifficulties(quizSet) {
  return [...new Set((quizSet.questions ?? []).map((question) => question.difficulty))];
}

function renderSetList() {
  const quizSets = getFilteredSets();
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent = state.quizHistory.length + "セット";

  if (state.quizHistory.length === 0) {
    elements.quizContent.append(
      createElement("p", {
        className: "empty",
        text: "クイズ履歴はまだありません。"
      })
    );
    return;
  }

  if (quizSets.length === 0) {
    elements.quizContent.append(
      createElement("p", {
        className: "empty",
        text: "条件に一致するクイズがありません。"
      })
    );
    return;
  }

  const list = createElement("div", { className: "set-list" });

  for (const quizSet of quizSets) {
    const answerLink = createElement("a", {
      className: "primary-button inline-link",
      href: "quizzes.html?set=" + encodeURIComponent(quizSet.id),
      text: "回答する"
    });
    answerLink.addEventListener("click", (event) => {
      event.preventDefault();
      selectSet(quizSet.id);
    });

    const children = [
      createElement("h3", { text: quizSet.title }),
      createElement("div", { className: "quiz-meta" }, [
        renderBadge(labelMaps.actionType[quizSet.actionType] ?? quizSet.actionType),
        createElement("span", { text: (quizSet.questions ?? []).length + "問" }),
        createElement("span", { text: formatDate(quizSet.createdAt) })
      ]),
      createElement(
        "div",
        { className: "question-meta" },
        getDifficulties(quizSet).map((difficulty) => renderBadge(labelMaps.difficulty[difficulty] ?? difficulty))
      )
    ];

    if (quizSet.generationReason) {
      children.push(createElement("p", { className: "quiz-reason", text: quizSet.generationReason }));
    }

    children.push(createElement("div", { className: "item-actions" }, [answerLink]));
    list.append(createElement("article", { className: "quiz-set" }, children));
  }

  elements.quizContent.append(list);
}

function normalizeAnswer(value) {
  return String(value ?? "").trim().replace(/s+/g, " ");
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

function updateProgress(quizSet) {
  const progress = document.querySelector("#quiz-progress");
  if (!progress) {
    return;
  }

  const questions = quizSet.questions ?? [];
  const results = questions
    .map((question) => state.answers.get(getQuestionKey(quizSet, question)))
    .filter(Boolean);
  const correctCount = results.filter((result) => result.correct).length;
  progress.textContent = "回答済み " + results.length + "/" + questions.length + "問 / 正解 " + correctCount + "問";
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

function renderChoiceQuestion(quizSet, question, result, resultNode) {
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
      updateProgress(quizSet);
    });

    list.append(button);
  }

  return list;
}

function renderTextQuestion(quizSet, question, result, resultNode) {
  const wrapper = createElement("div", { className: "text-answer" });
  const input = createElement("input", {
    type: "text",
    value: result?.value ?? "",
    ariaLabel: "回答"
  });
  const button = createElement("button", {
    className: "primary-button",
    type: "button",
    text: "判定"
  });

  button.addEventListener("click", () => {
    storeAnswer(quizSet, question, input.value);
    resultNode.replaceChildren(renderFeedback(question, state.answers.get(getQuestionKey(quizSet, question))));
    updateProgress(quizSet);
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

function renderQuestion(quizSet, question, index) {
  const key = getQuestionKey(quizSet, question);
  const result = state.answers.get(key);
  const resultNode = createElement("div", { className: "result-slot" }, [renderFeedback(question, result)]);
  const type = question.type ?? "multiple-choice";
  const children = [
    createElement("div", { className: "question-header" }, [
      createElement("span", { className: "question-number", text: "Q" + (index + 1) }),
      renderBadge(labelMaps.difficulty[question.difficulty] ?? question.difficulty),
      renderBadge(labelMaps.type[type] ?? type)
    ]),
    createElement("p", { className: "question-prompt", text: question.prompt }),
    resultNode
  ];

  if (type === "multiple-choice" || type === "true-false") {
    children.push(renderChoiceQuestion(quizSet, question, result, resultNode));
  } else {
    children.push(renderTextQuestion(quizSet, question, result, resultNode));
  }

  return createElement("article", { className: "question-card" }, children);
}

function renderSelectedSet(quizSet) {
  const filteredQuestions = (quizSet.questions ?? []).filter(
    (question) => state.difficultyFilter === "all" || question.difficulty === state.difficultyFilter
  );
  elements.quizContent.replaceChildren();
  elements.quizCount.textContent = state.quizHistory.length + "セット";

  const backButton = createElement("button", {
    className: "secondary-button",
    type: "button",
    text: "一覧に戻る"
  });
  backButton.addEventListener("click", () => selectSet(""));

  const header = createElement("div", { className: "selected-quiz-header" }, [
    createElement("div", {}, [
      createElement("h2", { text: quizSet.title }),
      createElement("p", { id: "quiz-progress", className: "quiz-meta", text: "回答済み 0/" + filteredQuestions.length + "問 / 正解 0問" })
    ]),
    backButton
  ]);

  const questionList = createElement(
    "div",
    { className: "question-list" },
    filteredQuestions.map((question, index) => renderQuestion(quizSet, question, index))
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
      createElement("div", { className: "quiz-meta" }, [
        renderBadge(labelMaps.actionType[quizSet.actionType] ?? quizSet.actionType),
        createElement("span", { text: formatDate(quizSet.createdAt) })
      ]),
      questionList
    ])
  );
  updateProgress({ ...quizSet, questions: filteredQuestions });
}

function render() {
  const selectedSet = state.quizHistory.find((quizSet) => quizSet.id === state.selectedSetId);

  if (state.selectedSetId && selectedSet) {
    renderSelectedSet(selectedSet);
    return;
  }

  if (state.selectedSetId && !selectedSet) {
    state.selectedSetId = "";
  }

  renderSetList();
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
  state.selectedSetId = new URLSearchParams(window.location.search).get("set") ?? "";
  render();
});

loadData().catch((error) => {
  showMessage(elements.quizError, error.message);
});
