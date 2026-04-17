import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <div className="landing-head">
          <div>
            <h1 className="landing-title">課題管理MVP</h1>
            <p className="landing-sub">
              個人課題とクラス共有課題を同じ画面で整理し、締切忘れを減らすためのWebアプリです。
            </p>
          </div>
          <div className="landing-links">
            <Link href="/register">無料で開始</Link>
            <Link href="/login">ログイン</Link>
          </div>
        </div>

        <div className="feature-grid">
          <article className="feature">
            <h3>個人課題管理</h3>
            <p>課題の作成、編集、提出済み管理、締切順表示に対応。</p>
          </article>
          <article className="feature">
            <h3>共有機能</h3>
            <p>グループ作成と参加コード参加、共有課題の作成と閲覧が可能。</p>
          </article>
          <article className="feature">
            <h3>通知設定</h3>
            <p>通知先メール、通知日前数、通知ON/OFFをユーザー単位で設定。</p>
          </article>
          <article className="feature">
            <h3>PWA基礎</h3>
            <p>インストール可能なマニフェストとService Workerを実装。</p>
          </article>
        </div>
      </section>
    </main>
  );
}
