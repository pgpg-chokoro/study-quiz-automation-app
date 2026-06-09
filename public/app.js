const labelMaps = {
  priority: {
    high: "高",
    normal: "中",
    low: "低"
  },
  status: {
    active: "学習中",
    paused: "保留",
    archived: "完了"
  }
};

const priorityOrder = {
  high: 0,
  normal: 1,
  low: 2
};

const state = {
  topics: [],
  editingTopicId: ""
};

const elements = {
  form: document.querySelector("#topic-form"),
  topicId: document.querySelector("#topic-id"),
  target: document.querySelector("#target"),
  priority: document.querySelector("#priority"),
  status: document.querySelector("#status"),
  note: document.querySelector("#note"),
  saveTopicButton: document.querySelector("#save-topic-button"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
  formMode: document.querySelector("#form-mode"),
  topicError: document.querySelector("#topic-error"),
  topicList: document.querySelector("#topic-list"),
  topicCount: document.querySelector("#topic-count"),
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "リクエストに失敗しました。");
  }

  return payload;
}

async function loadData() {
  showMessage(elements.topicError, "");
  const topicPayload = await fetchJson("/api/topics");
  state.topics = topicPayload.topics ?? [];
  renderTopics();
}

function getTopicTarget(topic) {
  return topic.target ?? topic.title ?? "";
}

function getTopicNote(topic) {
  return topic.note ?? topic.detail ?? "";
}

function getTopicPayload() {
  return {
    target: elements.target.value,
    priority: elements.priority.value,
    status: elements.status.value,
    note: elements.note.value
  };
}

function resetForm() {
  state.editingTopicId = "";
  elements.topicId.value = "";
  elements.form.reset();
  elements.priority.value = "normal";
  elements.status.value = "active";
  elements.saveTopicButton.textContent = "保存";
  elements.cancelEditButton.hidden = true;
  elements.formMode.textContent = "新規メモ";
  elements.formMode.classList.remove("editing");
}

function startEditingTopic(topic) {
  state.editingTopicId = topic.id;
  elements.topicId.value = topic.id;
  elements.target.value = getTopicTarget(topic);
  elements.priority.value = topic.priority ?? "normal";
  elements.status.value = topic.status ?? "active";
  elements.note.value = getTopicNote(topic);
  elements.saveTopicButton.textContent = "更新";
  elements.cancelEditButton.hidden = false;
  elements.formMode.textContent = "編集中: " + getTopicTarget(topic);
  elements.formMode.classList.add("editing");
  elements.target.focus();
}

async function saveTopic(event) {
  event.preventDefault();
  showMessage(elements.topicError, "");

  try {
    const payload = getTopicPayload();

    if (state.editingTopicId) {
      await fetchJson("/api/topics/" + encodeURIComponent(state.editingTopicId), {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson("/api/topics", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    resetForm();
    await loadData();
  } catch (error) {
    showMessage(elements.topicError, error.message);
  }
}

async function removeTopic(topic) {
  const confirmed = window.confirm("「" + getTopicTarget(topic) + "」を削除しますか？");
  if (!confirmed) {
    return;
  }

  try {
    await fetchJson("/api/topics/" + encodeURIComponent(topic.id), {
      method: "DELETE"
    });
    await loadData();
  } catch (error) {
    showMessage(elements.topicError, error.message);
  }
}

function renderBadge(text, className = "") {
  return createElement("span", {
    className: ("badge " + className).trim(),
    text
  });
}

function getTopicSummary() {
  const total = state.topics.length;
  const active = state.topics.filter((topic) => topic.status === "active").length;
  const high = state.topics.filter((topic) => topic.priority === "high").length;
  return total + "件 / 学習中 " + active + "件 / 高優先 " + high + "件";
}

function getTopicSortKey(topic) {
  return [
    priorityOrder[topic.priority] ?? 9,
    -(new Date(topic.updatedAt ?? topic.createdAt ?? 0).getTime())
  ];
}

function compareTopics(a, b) {
  const [priorityA, dateA] = getTopicSortKey(a);
  const [priorityB, dateB] = getTopicSortKey(b);
  return priorityA - priorityB || dateA - dateB;
}

function renderTopicActions(topic) {
  const actions = createElement("div", { className: "item-actions" });
  const editButton = createElement("button", {
    className: "secondary-button compact-button",
    type: "button",
    text: "編集",
    "aria-label": getTopicTarget(topic) + "を編集"
  });
  editButton.addEventListener("click", () => startEditingTopic(topic));

  const deleteButton = createElement("button", {
    className: "danger-button compact-button",
    type: "button",
    text: "削除",
    "aria-label": getTopicTarget(topic) + "を削除"
  });
  deleteButton.addEventListener("click", () => removeTopic(topic));
  actions.append(editButton, deleteButton);
  return actions;
}

function renderTopics() {
  elements.topicList.replaceChildren();
  elements.topicCount.textContent = getTopicSummary();

  if (state.topics.length === 0) {
    elements.topicList.append(
      createElement("p", {
        className: "empty",
        text: "学習メモはまだありません。"
      })
    );
    return;
  }

  const sortedTopics = [...state.topics].sort(compareTopics);

  for (const topic of sortedTopics) {
    const meta = createElement("div", { className: "topic-meta" }, [
      renderBadge(labelMaps.priority[topic.priority] ?? topic.priority, "priority-" + topic.priority),
      renderBadge(labelMaps.status[topic.status] ?? topic.status, "status-" + topic.status)
    ]);

    const note = getTopicNote(topic);
    const body = [
      createElement("div", { className: "topic-card-header" }, [
        createElement("div", {}, [
          createElement("h3", { text: getTopicTarget(topic) }),
          meta
        ]),
        renderTopicActions(topic)
      ])
    ];

    if (note) {
      body.push(createElement("p", { className: "topic-note", text: note }));
    }

    body.push(
      createElement("p", {
        className: "topic-updated",
        text: "更新: " + formatDate(topic.updatedAt)
      })
    );

    elements.topicList.append(createElement("article", { className: "topic-card" }, body));
  }
}

elements.form.addEventListener("submit", saveTopic);
elements.cancelEditButton.addEventListener("click", resetForm);
elements.refreshButton.addEventListener("click", () => {
  loadData().catch((error) => showMessage(elements.topicError, error.message));
});

loadData().catch((error) => {
  showMessage(elements.topicError, error.message);
});
