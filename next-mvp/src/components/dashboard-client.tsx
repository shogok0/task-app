"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Me = { id: string; displayName: string; email: string };

type Task = {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  deadlineAt: string;
  groupId: string | null;
  scopeType: "PERSONAL" | "GROUP";
  submissionStatus: "PENDING" | "SUBMITTED";
  urgency: "overdue" | "high" | "medium" | "low";
  group: null | { id: string; name: string };
};

type GroupMembership = {
  id: string;
  role: "MEMBER" | "ADMIN";
  group: {
    id: string;
    name: string;
    code: string;
  };
};

type NotificationSetting = {
  emailEnabled: boolean;
  emailAddress: string | null;
  remindBeforeDays: number;
  pushEnabled: boolean;
};

type Tab = "pending" | "submitted" | "calendar";

export function DashboardClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [setting, setSetting] = useState<NotificationSetting>({
    emailEnabled: false,
    emailAddress: "",
    remindBeforeDays: 1,
    pushEnabled: false,
  });
  const [tab, setTab] = useState<Tab>("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [taskForm, setTaskForm] = useState({
    subject: "",
    title: "",
    description: "",
    deadlineAt: "",
    groupId: "",
  });
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      setMe(meData.user);

      const [taskRes, groupRes, settingRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/groups"),
        fetch("/api/notifications/settings"),
      ]);

      if (!taskRes.ok || !groupRes.ok || !settingRes.ok) {
        throw new Error("データ取得に失敗しました。");
      }

      const taskData = await taskRes.json();
      const groupData = await groupRes.json();
      const settingData = await settingRes.json();

      setTasks(taskData.tasks);
      setGroups(groupData.groups);
      setSetting(settingData.setting);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTasks = useMemo(() => {
    if (tab === "pending") {
      return tasks.filter((task) => task.submissionStatus === "PENDING");
    }

    if (tab === "submitted") {
      return tasks.filter((task) => task.submissionStatus === "SUBMITTED");
    }

    return tasks;
  }, [tasks, tab]);

  const calendarMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = new Date(task.deadlineAt).toLocaleDateString("ja-JP");
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: taskForm.subject,
          title: taskForm.title,
          description: taskForm.description || null,
          deadlineAt: taskForm.deadlineAt,
          groupId: taskForm.groupId || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "課題作成に失敗しました。");
      }

      setTaskForm({ subject: "", title: "", description: "", deadlineAt: "", groupId: "" });
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "課題作成に失敗しました。");
    }
  }

  async function toggle(taskId: string, submitted: boolean) {
    setError("");
    try {
      const res = await fetch(`/api/tasks/${taskId}/submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitted }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "状態更新に失敗しました。");
      }

      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "状態更新に失敗しました。");
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "グループ作成に失敗しました。");
      }

      setGroupName("");
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "グループ作成に失敗しました。");
    }
  }

  async function joinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "グループ参加に失敗しました。");
      }

      setJoinCode("");
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "グループ参加に失敗しました。");
    }
  }

  async function leaveGroup(groupId: string) {
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "グループ退出に失敗しました。");
      }

      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "グループ退出に失敗しました。");
    }
  }

  async function saveNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "通知設定の保存に失敗しました。");
      }

      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "通知設定の保存に失敗しました。");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <main className="dashboard-shell">読み込み中...</main>;
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <h1>課題管理MVP</h1>
          <p>
            こんにちは、{me?.displayName}さん。個人課題と共有課題を一緒に管理できます。
          </p>
        </div>
        <button onClick={logout} className="ghost-btn" type="button">
          ログアウト
        </button>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel">
        <h2>課題を作成</h2>
        <form className="grid-form" onSubmit={createTask}>
          <label>
            科目
            <input
              value={taskForm.subject}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, subject: e.target.value }))}
              required
            />
          </label>
          <label>
            課題名
            <input
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </label>
          <label>
            締切
            <input
              type="datetime-local"
              value={taskForm.deadlineAt}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, deadlineAt: e.target.value }))}
              required
            />
          </label>
          <label>
            対象グループ（任意）
            <select
              value={taskForm.groupId}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, groupId: e.target.value }))}
            >
              <option value="">個人課題</option>
              {groups.map((membership) => (
                <option key={membership.group.id} value={membership.group.id}>
                  {membership.group.name} ({membership.role})
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            詳細
            <textarea
              rows={3}
              value={taskForm.description}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
          <button type="submit" className="primary-btn">
            課題を追加
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="tabs">
          <button type="button" onClick={() => setTab("pending")} data-active={tab === "pending"}>
            未提出
          </button>
          <button
            type="button"
            onClick={() => setTab("submitted")}
            data-active={tab === "submitted"}
          >
            提出済み
          </button>
          <button type="button" onClick={() => setTab("calendar")} data-active={tab === "calendar"}>
            カレンダー
          </button>
        </div>

        {tab === "calendar" ? (
          <div className="calendar-block">
            {calendarMap.map(([date, list]) => (
              <article key={date} className="calendar-day">
                <h3>{date}</h3>
                <ul>
                  {list.map((task) => (
                    <li key={task.id}>
                      <span>{task.title}</span>
                      <small>{task.scopeType === "GROUP" ? task.group?.name : "個人課題"}</small>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <ul className="task-list">
            {filteredTasks.map((task) => (
              <li key={task.id} data-urgency={task.urgency}>
                <div>
                  <strong>{task.title}</strong>
                  <p>
                    {task.subject} / {new Date(task.deadlineAt).toLocaleString("ja-JP")} /{" "}
                    {task.scopeType === "GROUP" ? `共有(${task.group?.name})` : "個人"}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => toggle(task.id, task.submissionStatus !== "SUBMITTED")}
                >
                  {task.submissionStatus === "SUBMITTED" ? "未提出に戻す" : "提出済みにする"}
                </button>
              </li>
            ))}
            {filteredTasks.length === 0 ? <li>表示する課題はありません。</li> : null}
          </ul>
        )}
      </section>

      <section className="panel two-col">
        <div>
          <h2>グループ管理</h2>
          <form onSubmit={createGroup} className="inline-form">
            <input
              placeholder="新規グループ名"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
            <button type="submit" className="primary-btn">
              作成
            </button>
          </form>
          <form onSubmit={joinGroup} className="inline-form">
            <input
              placeholder="参加コード"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
            <button type="submit" className="primary-btn">
              参加
            </button>
          </form>
          <ul className="group-list">
            {groups.map((membership) => (
              <li key={membership.id}>
                <div>
                  <strong>{membership.group.name}</strong>
                  <p>
                    参加コード: {membership.group.code} / ロール: {membership.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => leaveGroup(membership.group.id)}
                  className="ghost-btn"
                >
                  退出
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>通知設定</h2>
          <form onSubmit={saveNotification} className="grid-form">
            <label>
              <input
                type="checkbox"
                checked={setting.emailEnabled}
                onChange={(e) => setSetting((prev) => ({ ...prev, emailEnabled: e.target.checked }))}
              />
              メール通知を有効化
            </label>
            <label>
              通知先メール
              <input
                type="email"
                value={setting.emailAddress ?? ""}
                onChange={(e) => setSetting((prev) => ({ ...prev, emailAddress: e.target.value }))}
              />
            </label>
            <label>
              締切何日前に通知するか
              <input
                type="number"
                min={0}
                max={30}
                value={setting.remindBeforeDays}
                onChange={(e) =>
                  setSetting((prev) => ({
                    ...prev,
                    remindBeforeDays: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={setting.pushEnabled}
                onChange={(e) => setSetting((prev) => ({ ...prev, pushEnabled: e.target.checked }))}
              />
              Push通知（MVPでは準備段階）
            </label>
            <button type="submit" className="primary-btn">
              通知設定を保存
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
