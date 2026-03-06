from flask import Flask, render_template, request, redirect, session, jsonify
import os
from datetime import datetime, timedelta

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


@app.route("/")
def index():
    user_id = session.get("user_id")

    if not user_id:
        return render_template("login.html", error=None)

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    "SELECT id,subject,task,deadline,done FROM tasks WHERE user_id=%s ORDER BY deadline ASC",
                    (user_id,),
                )
                rows = c.fetchall()
    except Exception:
        app.logger.exception("Failed to fetch tasks")
        session.clear()
        return render_template(
            "login.html", error="サーバーに接続できません。少し待って再試行してください。"
        )

    tasks = []

    for row in rows:
        days_left = None

        if row[3]:
            d = row[3]
            if isinstance(d, str):
                d = datetime.strptime(d, "%Y-%m-%d").date()

            today = datetime.now().date()
            days_left = (d - today).days

        tasks.append(
            {
                "id": row[0],
                "subject": row[1],
                "task": row[2],
                "deadline": row[3],
                "done": row[4],
                "days_left": days_left,
            }
        )

    return render_template("index.html", tasks=tasks)


@app.route("/register", methods=["POST"])
def register():
    username = request.form.get("username")
    password = request.form.get("password")

    if not username or not password:
        return render_template("login.html", error="入力してください")

    try:
        hashed = generate_password_hash(password)
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    "INSERT INTO users(username,password) VALUES(%s,%s)",
                    (username, hashed),
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


@app.route("/add", methods=["POST"])
def add():
    user_id = session.get("user_id")

    if not user_id:
        return redirect("/")

    subject = request.form.get("subject")
    task = request.form.get("task")
    deadline = request.form.get("deadline")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    "INSERT INTO tasks(user_id,subject,task,deadline,done) VALUES(%s,%s,%s,%s,0)",
                    (user_id, subject, task, deadline),
                )
    except Exception:
        app.logger.exception("Failed to add task")

    return redirect("/")


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete(task_id):
    user_id = session.get("user_id")

    if not user_id:
        return redirect("/")

    try:
        with get_conn() as conn:
            with conn.cursor() as c:
                c.execute(
                    "DELETE FROM tasks WHERE id=%s AND user_id=%s",
                    (task_id, user_id),
                )
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
                c.execute(
                    "UPDATE tasks SET done=CASE WHEN done=1 THEN 0 ELSE 1 END WHERE id=%s AND user_id=%s",
                    (task_id, user_id),
                )
    except Exception:
        app.logger.exception("Failed to toggle task state")

    return redirect("/")


if __name__ == "__main__":
    ensure_db_initialized(force=True)
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
