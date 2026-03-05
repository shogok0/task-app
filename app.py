from flask import Flask, render_template, request, redirect, make_response
import psycopg2
import os
import uuid
from datetime import datetime
import hashlib

app = Flask(__name__)


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def init_db():

    conn = get_conn()
    c = conn.cursor()

    # usersテーブル
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
    )
    """)

    # tasksテーブル
    c.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        subject TEXT,
        task TEXT,
        deadline TEXT,
        done INTEGER DEFAULT 0
    )
    """)

    conn.commit()
    conn.close()


init_db()


@app.route("/")
def index():

    user_id = request.cookies.get("user_id")

    if not user_id:
        user_id = str(uuid.uuid4())

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "SELECT id, subject, task, deadline, done FROM tasks WHERE user_id=%s ORDER BY deadline ASC",
        (user_id,)
    )

    rows = c.fetchall()

    tasks = []

    for row in rows:

        days_left = None

        if row[3]:
            d = datetime.strptime(row[3], "%Y-%m-%d")
            days_left = (d - datetime.now()).days

        tasks.append({
            "id": row[0],
            "subject": row[1],
            "task": row[2],
            "deadline": row[3],
            "done": row[4],
            "days_left": days_left
        })

    conn.close()

    resp = make_response(render_template("index.html", tasks=tasks))
    resp.set_cookie("user_id", user_id)

    return resp


@app.route("/add", methods=["POST"])
def add():

    user_id = request.cookies.get("user_id")

    subject = request.form["subject"]
    task = request.form["task"]
    deadline = request.form["deadline"]

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "INSERT INTO tasks (user_id, subject, task, deadline, done) VALUES (%s,%s,%s,%s,0)",
        (user_id, subject, task, deadline)
    )

    conn.commit()
    conn.close()

    return redirect("/")


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete(task_id):

    user_id = request.cookies.get("user_id")

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "DELETE FROM tasks WHERE id=%s AND user_id=%s",
        (task_id, user_id)
    )

    conn.commit()
    conn.close()

    return redirect("/")


@app.route("/toggle/<int:task_id>", methods=["POST"])
def toggle(task_id):

    user_id = request.cookies.get("user_id")

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "UPDATE tasks SET done = CASE WHEN done=1 THEN 0 ELSE 1 END WHERE id=%s AND user_id=%s",
        (task_id, user_id)
    )

    conn.commit()
    conn.close()

    return redirect("/")


# ===== ユーザー登録 =====
@app.route("/register", methods=["POST"])
def register():

    username = request.form["username"]
    password = hashlib.sha256(request.form["password"].encode()).hexdigest()

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "INSERT INTO users (username, password) VALUES (%s, %s)",
        (username, password)
    )

    conn.commit()
    conn.close()

    return redirect("/")


# ===== ログイン =====
@app.route("/login", methods=["POST"])
def login():

    username = request.form["username"]
    password = hashlib.sha256(request.form["password"].encode()).hexdigest()

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "SELECT id FROM users WHERE username=%s AND password=%s",
        (username, password)
    )

    user = c.fetchone()

    conn.close()

    if user:
        resp = make_response(redirect("/"))
        resp.set_cookie("user_id", str(user[0]))
        return resp

    return redirect("/")


# ===== ログアウト =====
@app.route("/logout")
def logout():

    resp = make_response(redirect("/"))
    resp.set_cookie("user_id", "", expires=0)

    return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)