from flask import Flask, render_template, request, redirect, session
import psycopg2
import os
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def init_db():

    conn = get_conn()
    c = conn.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
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

    user_id = session.get("user_id")

    if not user_id:
        return render_template("login.html")

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

    return render_template("index.html", tasks=tasks)


@app.route("/register", methods=["POST"])
def register():

    username = request.form["username"]
    password = generate_password_hash(request.form["password"])

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "INSERT INTO users (username, password) VALUES (%s, %s)",
        (username, password)
    )

    conn.commit()
    conn.close()

    return redirect("/")


@app.route("/login", methods=["POST"])
def login():

    username = request.form["username"]
    password = request.form["password"]

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "SELECT id, password FROM users WHERE username=%s",
        (username,)
    )

    user = c.fetchone()

    conn.close()

    if user and check_password_hash(user[1], password):

        session["user_id"] = user[0]

        return redirect("/")

    return redirect("/")


@app.route("/logout")
def logout():

    session.clear()

    return redirect("/")


@app.route("/add", methods=["POST"])
def add():

    user_id = session.get("user_id")

    if not user_id:
        return redirect("/")

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

    user_id = session.get("user_id")

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

    user_id = session.get("user_id")

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "UPDATE tasks SET done = CASE WHEN done=1 THEN 0 ELSE 1 END WHERE id=%s AND user_id=%s",
        (task_id, user_id)
    )

    conn.commit()
    conn.close()

    return redirect("/")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)