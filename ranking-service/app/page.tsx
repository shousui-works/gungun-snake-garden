export default function Home() {
  return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f7f6ee', color: '#3c493b', fontFamily: 'system-ui' }}>
    <section style={{ textAlign: 'center', padding: 32 }}>
      <p style={{ color: '#9476cf' }}>おにわで すくすく</p><h1>ぐんぐん ヘビの庭</h1>
      <p>ランキングは ゲームの中で見られるよ。</p>
      <a style={{ display: 'inline-block', marginTop: 20, padding: '16px 32px', borderRadius: 16, background: '#9476cf', color: 'white', textDecoration: 'none' }} href="https://shousui-works.github.io/gungun-snake-garden/">ゲームで あそぶ</a>
    </section>
  </main>;
}
