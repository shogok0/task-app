from flask import Flask, render_template, request, redirect, make_response
import psycopg2
import os
from datetime import datetime

app = Flask(__name__)


def init_db():
    conn = psycopg2.connect(os.environ["postgresql://taskuser:1sGy7y37XsKlIkihXjkT7SfQ76dtgv39@dpg-d6kqtr7afjfc73ekt9eg-a.oregon-postgres.render.com/taskdb_pbzx"])
    c = conn.cursor()

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

    conn = psycopg2.connect(os.environ["postgresql://taskuser:1sGy7y37XsKlIkihXjkT7SfQ76dtgv39@dpg-d6kqtr7afjfc73ekt9eg-a.oregon-postgres.render.com/taskdb_pbzx"])
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("""
    SELECT * FROM tasks 
    WHERE user_id=? 
    ORDER BY deadline ASC
    """, (user_id,))

    rows = c.fetchall()

    tasks = []

    for row in rows:

        days_left = None

        if row["deadline"]:
            d = datetime.strptime(row["deadline"], "%Y-%m-%d")
            days_left = (d - datetime.now()).days

        tasks.append({
            "id": row["id"],
            "subject": row["subject"],
            "task": row["task"],
            "deadline": row["deadline"],
            "done": row["done"],
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

    conn = psycopg2.connect(os.environ["postgresql://taskuser:1sGy7y37XsKlIkihXjkT7SfQ76dtgv39@dpg-d6kqtr7afjfc73ekt9eg-a.oregon-postgres.render.com/taskdb_pbzx"])
    c = conn.cursor()

    c.execute(
        "INSERT INTO tasks (user_id, subject, task, deadline, done) VALUES (?, ?, ?, ?, 0)",
        (user_id, subject, task, deadline)
    )

    conn.commit()
    conn.close()

    return redirect("/")


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete(task_id):

    user_id = request.cookies.get("user_id")

    conn = psycopg2.connect(os.environ["postgresql://taskuser:1sGy7y37XsKlIkihXjkT7SfQ76dtgv39@dpg-d6kqtr7afjfc73ekt9eg-a.oregon-postgres.render.com/taskdb_pbzx"])
    c = conn.cursor()

    c.execute(
        "DELETE FROM tasks WHERE id=? AND user_id=?",
        (task_id, user_id)
    )

    conn.commit()
    conn.close()

    return redirect("/")


@app.route("/toggle/<int:task_id>", methods=["POST"])
def toggle(task_id):

    user_id = request.cookies.get("user_id")

    conn = psycopg2.connect(os.environ["postgresql://taskuser:1sGy7y37XsKlIkihXjkT7SfQ76dtgv39@dpg-d6kqtr7afjfc73ekt9eg-a.oregon-postgres.render.com/taskdb_pbzx"])
    c = conn.cursor()

    c.execute(
        "UPDATE tasks SET done = CASE WHEN done=1 THEN 0 ELSE 1 END WHERE id=? AND user_id=?",
        (task_id, user_id)
    )

    conn.commit()
    conn.close()

    return redirect("/")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)

import hashlib

@app.route("/register", methods=["POST"])
def register():

    username = request.form["username"]
    password = hashlib.sha256(request.form["password"].encode()).hexdigest()

    conn = psycopg2.connect(os.environ["postgresql://taskuser:1sGy7y37XsKlIkihXjkT7SfQ76dtgv39@dpg-d6kqtr7afjfc73ekt9eg-a.oregon-postgres.render.com/taskdb_pbzx"])
    c = conn.cursor()

    c.execute(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        (username, password)
    )

    conn.commit()
    conn.close()

    return redirect("/")

@app.route("/login", methods=["POST"])
def login():

    username = request.form["username"]
    password = hashlib.sha256(request.form["password"].encode()).hexdigest()

    conn = psycopg2.connect(os.environ["postgresql://taskuser:1sGy7y37XsKlIkihXjkT7SfQ76dtgv39@dpg-d6kqtr7afjfc73ekt9eg-a.oregon-postgres.render.com/taskdb_pbzx"])
    c = conn.cursor()

    c.execute(
        "SELECT id FROM users WHERE username=? AND password=?",
        (username, password)
    )

    user = c.fetchone()

    conn.close()

    if user:
        resp = make_response(redirect("/"))
        resp.set_cookie("user_id", str(user[0]))
        return resp

    return redirect("/")

