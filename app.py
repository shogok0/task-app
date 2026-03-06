from flask import Flask, render_template, request, redirect, session, jsonify
import os
import random
import smtplib
import string
from datetime import datetime, timedelta
from email.message import EmailMessage

import psycopg2
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)


@app.route("/privacy")
def privacy():
    return render_template("privacy.html")


@app.route("/terms")
def terms():
    return render_template("terms.html")


app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.permanent_session_lifetime = timedelta(days=30)

DB_INIT_RETRY_SECONDS = 15
_db_initialized = False
_last_db_init_try = None


def get_conn():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    conn_kwargs = {"connect_timeout": 8}
    if "sslmode=" not in database_url:
        conn_kwargs["sslmode"] = os.environ.get("DB_SSLMODE", "require")

    return psycopg2.connect(database_url, **conn_kwargs)


def init_db():
    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users(
                        id SERIAL PRIMARY KEY,
                        username TEXT UNIQUE,
                        password TEXT
                    )
                    """
                )
                c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT")
                c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_enabled INTEGER DEFAULT 0")
                c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_before_days INTEGER DEFAULT 1")

                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS schools(
                        id SERIAL PRIMARY KEY,
                        name TEXT NOT NULL,
                        created_by INTEGER REFERENCES users(id)
                    )
                    """
                )

                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS classes(
                        id SERIAL PRIMARY KEY,
                        school_id INTEGER REFERENCES schools(id),
                        name TEXT NOT NULL,
                        join_code TEXT UNIQUE,
                        created_by INTEGER REFERENCES users(id)
                    )
                    """
                )

                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS class_members(
                        id SERIAL PRIMARY KEY,
                        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        role TEXT DEFAULT 'student',
                        UNIQUE(class_id, user_id)
                    )
                    """
                )

                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tasks(
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER,
                        subject TEXT,
                        task TEXT,
                        deadline DATE,
                        done INTEGER DEFAULT 0
                    )
                    """
                )
                c.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL")

                c.execute(
                    """
                    CREATE TABLE IF NOT EXISTS task_notifications(
                        id SERIAL PRIMARY KEY,
                        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        sent_for_date DATE NOT NULL,
                        sent_at TIMESTAMP DEFAULT NOW(),
                        UNIQUE(task_id, user_id, sent_for_date)
                    )
                    """
                )
        return True
    except Exception:
        app.logger.exception("Database initialization failed")
        return False


def ensure_db_initialized(force=False):
    global _db_initialized, _last_db_init_try

    now = datetime.utcnow()
    if _db_initialized and not force:
        return True

    if not force and _last_db_init_try is not None:
        elapsed = (now - _last_db_init_try).total_seconds()
        if elapsed < DB_INIT_RETRY_SECONDS:
            return False

    _last_db_init_try = now
    _db_initialized = init_db()
    return _db_initialized


def gen_join_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choice(chars) for _ in range(length))


def can_manage_task(task_user_id, task_class_id, member_role, user_id):
    if task_user_id == user_id:
        return True
    if task_class_id and member_role in ("teacher", "admin"):
        return True
    return False


def can_toggle_task(task_user_id, task_class_id, member_role, user_id):
    if task_user_id == user_id:
        return True
    if task_class_id and member_role is not None:
        return True
    return False


def send_email(to_email, subject, body):
    host = os.environ.get("SMTP_HOST")
    username = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")
    from_email = os.environ.get("SMTP_FROM", username)
    port = int(os.environ.get("SMTP_PORT", "587"))
    use_tls = os.environ.get("SMTP_USE_TLS", "1") == "1"

    if not host or not from_email:
        app.logger.warning("SMTP not configured; skipping email send")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(msg)
        return True
    except Exception:
        app.logger.exception("Failed to send email")
        return False


def send_deadline_reminders():
    sent_count = 0
    skipped_count = 0

    with get_conn() as conn:
        with conn.cursor() as c:
            c.execute(
                """
                SELECT
                    t.id,
                    u.id,
                    u.email,
                    t.subject,
                    t.task,
                    t.deadline,
                    COALESCE(cl.name, '')
                FROM tasks t
                JOIN users u ON u.id = t.user_id
                LEFT JOIN classes cl ON cl.id = t.class_id
                WHERE
                    t.done = 0
                    AND t.deadline IS NOT NULL
                    AND u.notify_enabled = 1
                    AND u.email IS NOT NULL
                    AND u.email <> ''
                    AND t.deadline = CURRENT_DATE + (u.notify_before_days * INTERVAL '1 day')
                    AND NOT EXISTS (
                        SELECT 1
                        FROM task_notifications tn
                        WHERE tn.task_id = t.id
                          AND tn.user_id = u.id
                          AND tn.sent_for_date = CURRENT_DATE
                    )
                """
            )
            personal_targets = c.fetchall()

            c.execute(
                """
                SELECT DISTINCT
                    t.id,
                    u.id,
                    u.email,
                    t.subject,
                    t.task,
                    t.deadline,
                    COALESCE(cl.name, '')
                FROM tasks t
                JOIN classes cl ON cl.id = t.class_id
                JOIN class_members cm ON cm.class_id = cl.id
                JOIN users u ON u.id = cm.user_id
                WHERE
                    t.done = 0
                    AND t.deadline IS NOT NULL
                    AND u.notify_enabled = 1
                    AND u.email IS NOT NULL
                    AND u.email <> ''
                    AND t.deadline = CURRENT_DATE + (u.notify_before_days * INTERVAL '1 day')
                    AND NOT EXISTS (
                        SELECT 1
                        FROM task_notifications tn
                        WHERE tn.task_id = t.id
                          AND tn.user_id = u.id
                          AND tn.sent_for_date = CURRENT_DATE
                    )
                """
            )
            class_targets = c.fetchall()

            for task_id, user_id, email, subject, task_text, deadline, class_name in personal_targets + class_targets:
                scope = f"クラス: {class_name}\n" if class_name else ""
                body = (
                    f"締切通知\n\n"
                    f"{scope}科目: {subject or '-'}\n"
                    f"課題: {task_text or '-'}\n"
                    f"締切: {deadline}\n"
                    f"\n課題管理アプリで確認してください。"
                )
                ok = send_email(email, "[課題管理] 締切通知", body)
                if ok:
                    c.execute(
                        """
                        INSERT INTO task_notifications(task_id, user_id, sent_for_date)
                        VALUES(%s, %s, CURRENT_DATE)
                        ON CONFLICT (task_id, user_id, sent_for_date) DO NOTHING
                        """,
                        (task_id, user_id),
                    )
                    sent_count += 1
                else:
                    skipped_count += 1

    return sent_count, skipped_count


@app.before_request
def warmup_db():
    if request.path == "/healthz":
        return None
    ensure_db_initialized()
    return None


@app.route("/healthz")
def healthz():
    if ensure_db_initialized():
        return jsonify({"status": "ok"}), 200
    return jsonify({"status": "degraded", "reason": "database unavailable"}), 503


@app.route("/cron/send-reminders", methods=["POST"])
def cron_send_reminders():
    expected = os.environ.get("CRON_SECRET")
    token = request.headers.get("X-Cron-Token") or request.args.get("token")
    if expected and token != expected:
        return jsonify({"error": "forbidden"}), 403

    try:
        sent_count, skipped_count = send_deadline_reminders()
        return jsonify({"status": "ok", "sent": sent_count, "skipped": skipped_count}), 200
    except Exception:
        app.logger.exception("Failed to send reminders")
        return jsonify({"status": "error"}), 500


def load_dashboard_data(user_id):
    with get_conn() as conn:
        with conn.cursor() as c:
            c.execute(
                """
                SELECT cm.class_id, cm.role, cl.name, cl.join_code, sc.id, sc.name
                FROM class_members cm
                JOIN classes cl ON cl.id = cm.class_id
                LEFT JOIN schools sc ON sc.id = cl.school_id
                WHERE cm.user_id = %s
                ORDER BY sc.name NULLS LAST, cl.name
                """,
                (user_id,),
            )
            memberships = c.fetchall()

            class_roles = {row[0]: row[1] for row in memberships}

            c.execute(
                """
                SELECT id, name
                FROM schools
                WHERE created_by = %s
                ORDER BY name
                """,
                (user_id,),
            )
            my_schools = c.fetchall()

            c.execute(
                """
                SELECT
                    t.id,
                    t.subject,
                    t.task,
                    t.deadline,
                    t.done,
                    t.user_id,
                    t.class_id,
                    COALESCE(cl.name, ''),
                    COALESCE(u.username, '')
                FROM tasks t
                LEFT JOIN classes cl ON cl.id = t.class_id
                LEFT JOIN users u ON u.id = t.user_id
                WHERE
                    t.user_id = %s
                    OR t.class_id IN (
                        SELECT class_id
                        FROM class_members
                        WHERE user_id = %s
                    )
                ORDER BY t.deadline ASC NULLS LAST, t.id DESC
                """,
                (user_id, user_id),
            )
            rows = c.fetchall()

            c.execute(
                """
                SELECT email, notify_enabled, notify_before_days
                FROM users
                WHERE id = %s
                """,
                (user_id,),
            )
            settings = c.fetchone()

    tasks = []
    for row in rows:
        days_left = None
        if row[3]:
            d = row[3]
            if isinstance(d, str):
                d = datetime.strptime(d, "%Y-%m-%d").date()
            today = datetime.now().date()
            days_left = (d - today).days

        member_role = class_roles.get(row[6]) if row[6] else None
        tasks.append(
            {
                "id": row[0],
                "subject": row[1],
                "task": row[2],
                "deadline": row[3],
                "done": row[4],
                "owner_id": row[5],
                "class_id": row[6],
                "class_name": row[7],
                "owner_name": row[8],
                "days_left": days_left,
                "can_manage": can_manage_task(row[5], row[6], member_role, user_id),
                "can_toggle": can_toggle_task(row[5], row[6], member_role, user_id),
            }
        )

    classes = [
        {"id": row[0], "role": row[1], "name": row[2], "join_code": row[3], "school_id": row[4], "school_name": row[5]}
        for row in memberships
    ]

    notify = {
        "email": settings[0] if settings else "",
        "enabled": bool(settings[1]) if settings else False,
        "before_days": settings[2] if settings else 1,
    }

    schools = [{"id": row[0], "name": row[1]} for row in my_schools]
    return tasks, classes, schools, notify


@app.route("/")
def index():
    user_id = session.get("user_id")
    if not user_id:
        return render_template("login.html", error=None)

    try:
        tasks, classes, schools, notify = load_dashboard_data(user_id)
        return render_template("index.html", tasks=tasks, classes=classes, schools=schools, notify=notify)
    except Exception:
        app.logger.exception("Failed to load dashboard")
        session.clear()
        return render_template("login.html", error="サーバーに接続できません。少し待って再試行してください。")


@app.route("/register", methods=["POST"])
def register():
    username = request.form.get("username")
    password = request.form.get("password")
    email = (request.form.get("email") or "").strip()

    if not username or not password:
        return render_template("login.html", error="入力してください")

    try:
        hashed = generate_password_hash(password)
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    "INSERT INTO users(username,password,email) VALUES(%s,%s,%s)",
                    (username, hashed, email),
                )
    except psycopg2.errors.UniqueViolation:
        return render_template("login.html", error="そのユーザー名は使われています")
    except Exception:
        app.logger.exception("Failed to register user")
        return render_template("login.html", error="登録に失敗しました。少し待って再試行してください。")

    return redirect("/")


@app.route("/login", methods=["POST"])
def login():
    username = request.form.get("username")
    password = request.form.get("password")

    if not username or not password:
        return render_template("login.html", error="ユーザー名とパスワードを入力してください")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    "SELECT id,password FROM users WHERE username=%s",
                    (username,),
                )
                user = c.fetchone()
    except Exception:
        app.logger.exception("Failed to login")
        return render_template("login.html", error="ログイン処理でエラーが発生しました。")

    if user and check_password_hash(user[1], password):
        session.permanent = True
        session["user_id"] = user[0]
        return redirect("/")

    return render_template("login.html", error="ログイン失敗")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


@app.route("/settings/notifications", methods=["POST"])
def update_notification_settings():
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    email = (request.form.get("email") or "").strip()
    enabled = 1 if request.form.get("notify_enabled") == "on" else 0

    try:
        before_days = int(request.form.get("notify_before_days") or "1")
    except ValueError:
        before_days = 1
    before_days = max(0, min(before_days, 30))

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    """
                    UPDATE users
                    SET email=%s, notify_enabled=%s, notify_before_days=%s
                    WHERE id=%s
                    """,
                    (email, enabled, before_days, user_id),
                )
    except Exception:
        app.logger.exception("Failed to update notification settings")

    return redirect("/")


@app.route("/schools/create", methods=["POST"])
def create_school():
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    name = (request.form.get("name") or "").strip()
    if not name:
        return redirect("/")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    "INSERT INTO schools(name, created_by) VALUES(%s, %s)",
                    (name, user_id),
                )
    except Exception:
        app.logger.exception("Failed to create school")

    return redirect("/")


@app.route("/classes/create", methods=["POST"])
def create_class():
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    name = (request.form.get("name") or "").strip()
    school_id = request.form.get("school_id")
    if not name:
        return redirect("/")

    try:
        school_id_val = int(school_id) if school_id else None
    except ValueError:
        school_id_val = None

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                join_code = gen_join_code()
                c.execute(
                    """
                    INSERT INTO classes(school_id, name, join_code, created_by)
                    VALUES(%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (school_id_val, name, join_code, user_id),
                )
                class_id = c.fetchone()[0]
                c.execute(
                    """
                    INSERT INTO class_members(class_id, user_id, role)
                    VALUES(%s, %s, 'teacher')
                    ON CONFLICT (class_id, user_id) DO NOTHING
                    """,
                    (class_id, user_id),
                )
    except Exception:
        app.logger.exception("Failed to create class")

    return redirect("/")


@app.route("/classes/join", methods=["POST"])
def join_class():
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    join_code = (request.form.get("join_code") or "").strip().upper()
    if not join_code:
        return redirect("/")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute("SELECT id FROM classes WHERE join_code=%s", (join_code,))
                row = c.fetchone()
                if row:
                    c.execute(
                        """
                        INSERT INTO class_members(class_id, user_id, role)
                        VALUES(%s, %s, 'student')
                        ON CONFLICT (class_id, user_id) DO NOTHING
                        """,
                        (row[0], user_id),
                    )
    except Exception:
        app.logger.exception("Failed to join class")

    return redirect("/")


def get_task_permission(c, task_id, user_id):
    c.execute(
        """
        SELECT
            t.id,
            t.user_id,
            t.class_id,
            (
                SELECT cm.role
                FROM class_members cm
                WHERE cm.class_id = t.class_id
                  AND cm.user_id = %s
                LIMIT 1
            ) AS member_role
        FROM tasks t
        WHERE t.id=%s
        """,
        (user_id, task_id),
    )
    row = c.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "task_user_id": row[1],
        "task_class_id": row[2],
        "member_role": row[3],
    }


@app.route("/add", methods=["POST"])
def add():
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    subject = request.form.get("subject")
    task = request.form.get("task")
    deadline = request.form.get("deadline")
    class_id_raw = request.form.get("class_id")

    class_id = None
    if class_id_raw:
        try:
            class_id = int(class_id_raw)
        except ValueError:
            class_id = None

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                if class_id:
                    c.execute(
                        "SELECT role FROM class_members WHERE class_id=%s AND user_id=%s",
                        (class_id, user_id),
                    )
                    if not c.fetchone():
                        return redirect("/")

                c.execute(
                    "INSERT INTO tasks(user_id,subject,task,deadline,done,class_id) VALUES(%s,%s,%s,%s,0,%s)",
                    (user_id, subject, task, deadline, class_id),
                )
    except Exception:
        app.logger.exception("Failed to add task")

    return redirect("/")


@app.route("/update/<int:task_id>", methods=["POST"])
def update_task(task_id):
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    subject = request.form.get("subject")
    task_text = request.form.get("task")
    deadline = request.form.get("deadline")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                perm = get_task_permission(c, task_id, user_id)
                if not perm:
                    return redirect("/")

                if not can_manage_task(perm["task_user_id"], perm["task_class_id"], perm["member_role"], user_id):
                    return redirect("/")

                c.execute(
                    "UPDATE tasks SET subject=%s, task=%s, deadline=%s WHERE id=%s",
                    (subject, task_text, deadline, task_id),
                )
    except Exception:
        app.logger.exception("Failed to update task")

    return redirect("/")


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete(task_id):
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                perm = get_task_permission(c, task_id, user_id)
                if not perm:
                    return redirect("/")

                if not can_manage_task(perm["task_user_id"], perm["task_class_id"], perm["member_role"], user_id):
                    return redirect("/")

                c.execute("DELETE FROM tasks WHERE id=%s", (task_id,))
    except Exception:
        app.logger.exception("Failed to delete task")

    return redirect("/")


@app.route("/toggle/<int:task_id>", methods=["POST"])
def toggle(task_id):
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                perm = get_task_permission(c, task_id, user_id)
                if not perm:
                    return redirect("/")

                if not can_toggle_task(perm["task_user_id"], perm["task_class_id"], perm["member_role"], user_id):
                    return redirect("/")

                c.execute(
                    "UPDATE tasks SET done=CASE WHEN done=1 THEN 0 ELSE 1 END WHERE id=%s",
                    (task_id,),
                )
    except Exception:
        app.logger.exception("Failed to toggle task state")

    return redirect("/")


if __name__ == "__main__":
    ensure_db_initialized(force=True)
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
