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

function renderTopics() {
  elements.topicList.replaceChildren();
  elements.topicCount.textContent = state.topics.length + "件";

  if (state.topics.length === 0) {
    elements.topicList.append(
      createElement("p", {
        className: "empty",
        text: "学習メモはまだありません。"
      })
    );
    return;
  }

  const sortedTopics = [...state.topics].sort((a, b) => {
    const dateA = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const dateB = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return dateB - dateA;
  });

  for (const topic of sortedTopics) {
    const meta = createElement("div", { className: "topic-meta" }, [
      renderBadge(labelMaps.priority[topic.priority] ?? topic.priority, "priority-" + topic.priority),
      renderBadge(labelMaps.status[topic.status] ?? topic.status, "status-" + topic.status)
    ]);

    const actions = createElement("div", { className: "item-actions" });
    const editButton = createElement("button", {
      className: "secondary-button",
      type: "button",
      text: "編集"
    });
    editButton.addEventListener("click", () => startEditingTopic(topic));

    const deleteButton = createElement("button", {
      className: "danger-button",
      type: "button",
      text: "削除"
    });
    deleteButton.addEventListener("click", () => removeTopic(topic));
    actions.append(editButton, deleteButton);

    const note = getTopicNote(topic);
    const children = [
      createElement("h3", { text: getTopicTarget(topic) }),
      meta
    ];

    if (note) {
      children.push(createElement("p", { className: "topic-note", text: note }));
    }

    children.push(
      createElement("p", {
        className: "topic-meta",
        text: "更新: " + formatDate(topic.updatedAt)
      }),
      actions
    );

    elements.topicList.append(createElement("article", { className: "topic-card" }, children));
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
