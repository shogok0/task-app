from flask import Flask, render_template, request, redirect
import sqlite3

app = Flask(__name__)

def init_db():
    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT,
        deadline TEXT
    )
    """)
    conn.commit()
    conn.close()

init_db()


@app.route("/")
def index():
    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()

    c.execute("SELECT id, task, deadline FROM tasks")

    tasks = [{"id":row[0], "task":row[1], "deadline":row[2]} for row in c.fetchall()]

    conn.close()

    return render_template("index.html", tasks=tasks)


@app.route("/add", methods=["POST"])
def add():
    task = request.form["task"]
    deadline = request.form["deadline"]

    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()

    c.execute("INSERT INTO tasks (task, deadline) VALUES (?,?)",(task,deadline))

    conn.commit()
    conn.close()

    return redirect("/")


@app.route("/delete/<int:task_id>")
def delete(task_id):

    conn = sqlite3.connect("tasks.db")
    c = conn.cursor()

    c.execute("DELETE FROM tasks WHERE id=?", (task_id,))

    conn.commit()
    conn.close()

    return redirect("/")


if __name__ == "__main__":
    app.run(debug=True)