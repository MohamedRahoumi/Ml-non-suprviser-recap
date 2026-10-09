import { useState, useEffect, useMemo } from "react";
import { ScatterChart, Scatter, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceDot } from "recharts";
import { Brain, Target, BarChart3, Activity, Circle, Database, GitBranch, ArrowLeft, ArrowRight, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";

/* ---------- Données fictives ---------- */
const C = ["#6366f1", "#10b981", "#f59e0b", "#ec4899"], GREY = "#94a3b8";
const rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-6)) * Math.cos(2 * Math.PI * r());
const blobs = (centers, n, sd, seed) => {
  const r = rng(seed);
  return centers.flatMap(([cx, cy]) => Array.from({ length: n }, () => ({ x: cx + gauss(r) * sd, y: cy + gauss(r) * sd })));
};
const moons = (() => {
  const r = rng(7), p = [];
  for (let i = 0; i < 100; i++) {
    const t = Math.PI * r();
    p.push({ x: Math.cos(t) * 5 + gauss(r) * 0.3, y: Math.sin(t) * 5 + gauss(r) * 0.3 });
    const u = Math.PI * r();
    p.push({ x: 5 - Math.cos(u) * 5 + gauss(r) * 0.3, y: 1.5 - Math.sin(u) * 5 + gauss(r) * 0.3 });
  }
  for (let i = 0; i < 14; i++) p.push({ x: -5 + r() * 15, y: -6 + r() * 12 });
  return p;
})();
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const assign = (pts, cs) => pts.map((p) => cs.reduce((b, c, i) => (d2(p, c) < d2(p, cs[b]) ? i : b), 0));
const update = (pts, l, cs) => cs.map((c, i) => {
  const m = pts.filter((_, j) => l[j] === i);
  return m.length ? { x: m.reduce((s, p) => s + p.x, 0) / m.length, y: m.reduce((s, p) => s + p.y, 0) / m.length } : c;
});
const kmeans = (pts, init, it = 15) => {
  let cs = init, l = assign(pts, cs);
  for (let i = 0; i < it; i++) { cs = update(pts, l, cs); l = assign(pts, cs); }
  return { l, cs };
};
const dbscan = (pts, eps, min) => {
  const n = pts.length, nb = pts.map((p) => pts.reduce((a, q, j) => (d2(p, q) <= eps * eps ? [...a, j] : a), []));
  const core = nb.map((a) => a.length >= min), lab = Array(n).fill(-1);
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (lab[i] !== -1 || !core[i]) continue;
    const st = [i]; lab[i] = c;
    while (st.length) nb[st.pop()].forEach((j) => { if (lab[j] === -1) { lab[j] = c; if (core[j]) st.push(j); } });
    c++;
  }
  return pts.map((p, i) => ({ ...p, c: lab[i], t: lab[i] === -1 ? "noise" : core[i] ? "core" : "border" }));
};
const blobs4 = blobs([[2, 2], [8, 3], [5, 8], [10, 9]], 35, 0.9, 11);
const blobs3 = blobs([[2, 2], [8, 3], [5, 8]], 30, 0.9, 5);
const byLabel = (pts, l, k, extra = {}) =>
  Array.from({ length: k }, (_, i) => ({ name: `Cluster ${i + 1}`, color: C[i], data: pts.filter((_, j) => l[j] === i), ...extra }));
const inertia = [1200, 540, 210, 170, 142, 125, 112, 102, 94, 88].map((v, i) => ({ k: i + 1, inertia: v }));
const M = [2, 3, 4, 5, 6, 7, 8].map((k, i) => ({
  k, sil: [0.52, 0.68, 0.61, 0.49, 0.43, 0.38, 0.34][i], db: [0.82, 0.51, 0.63, 0.79, 0.91, 1.02, 1.1][i], ch: [310, 480, 450, 390, 350, 320, 295][i],
}));

/* ---------- Composants UI ---------- */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}>{children}</div>
);
const Takeaway = ({ children }) => (
  <div className="flex items-center gap-2 rounded-xl bg-indigo-50 text-indigo-800 px-4 py-2 text-sm font-medium">
    <CheckCircle size={16} className="shrink-0" /> <span><b>À retenir :</b> {children}</span>
  </div>
);
const Slide = ({ n, title, sub, children, take }) => (
  <div className="h-full flex flex-col gap-4">
    <div className="flex items-center gap-4">
      <div className="h-11 w-11 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold text-lg shadow">{n}</div>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {sub && <p className="text-slate-500 text-sm md:text-base">{sub}</p>}
      </div>
    </div>
    <div className="flex-1 min-h-0">{children}</div>
    <Takeaway>{take}</Takeaway>
  </div>
);
const Scat = ({ series, h = 300, legend = true }) => (
  <div style={{ height: h }}>
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" dataKey="x" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
        <YAxis type="number" dataKey="y" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v) => (+v).toFixed(2)} />
        {legend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} shape={s.shape || "circle"} fillOpacity={s.op ?? 0.8} isAnimationActive={false}>
            {s.cells && s.data.map((p, i) => <Cell key={i} fill={s.cells(p)} />)}
          </Scatter>
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  </div>
);
const MiniLine = ({ data, dk, color, h = 130, bar }) => (
  <div style={{ height: h }}>
    <ResponsiveContainer width="100%" height="100%">
      {bar ? (
        <BarChart data={data} margin={{ left: -25, right: 5, top: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="k" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => [v, dk]} labelFormatter={(k) => `K = ${k}`} /><Bar dataKey={dk} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ left: -25, right: 5, top: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="k" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip formatter={(v) => [v, dk]} labelFormatter={(k) => `K = ${k}`} /><Line dataKey={dk} stroke={color} strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      )}
    </ResponsiveContainer>
  </div>
);

/* ---------- Slides ---------- */
const S1 = () => (
  <Slide n={1} title="K-Means & DBSCAN : Comprendre le Clustering" sub="Regrouper automatiquement des données sans étiquettes"
    take="le clustering découvre des groupes cachés, sans variable cible.">
    <div className="grid md:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-3">
        {[[Brain, "Apprentissage non supervisé", "Données sans variable cible"], [Target, "Objectif", "Regrouper les observations similaires"], [Database, "Cluster", "Un groupe de points proches entre eux"]].map(([I, t, d]) => (
          <Card key={t} className="flex items-center gap-3"><I className="text-indigo-600" /><div><div className="font-semibold">{t}</div><div className="text-sm text-slate-500">{d}</div></div></Card>
        ))}
        <Card className="bg-amber-50 border-amber-200 text-sm text-amber-900">🎬 Un catalogue de films : on regroupe automatiquement les films similaires selon leurs caractéristiques.</Card>
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
          <span className="px-3 py-1 rounded-full bg-slate-100">Unsupervised Learning</span><ArrowRight size={14} />
          <span className="px-3 py-1 rounded-full bg-slate-100">Clustering</span><ArrowRight size={14} />
          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">K-Means / DBSCAN</span>
        </div>
      </div>
      <Card><Scat h={340} series={[0, 1, 2, 3].map((i) => ({ name: `Groupe ${i + 1}`, color: C[i], data: blobs4.slice(i * 35, i * 35 + 35) }))} /></Card>
    </div>
  </Slide>
);

const S2 = () => {
  const [st, setSt] = useState(0);
  const init = [blobs3[0], blobs3[5], blobs3[70]];
  const l1 = useMemo(() => assign(blobs3, init), []);
  const c1 = useMemo(() => update(blobs3, l1, init), []);
  const fin = useMemo(() => kmeans(blobs3, init), []);
  const names = ["Initialisation", "Attribution", "Recalcul", "Convergence"];
  const labels = [null, l1, l1, fin.l][st], cents = [init, init, c1, fin.cs][st];
  const series = labels ? byLabel(blobs3, labels, 3) : [{ name: "Points", color: GREY, data: blobs3 }];
  series.push({ name: "Centroïdes", color: "#0f172a", op: 1, shape: "star", data: cents });
  const steps = ["Choisir K", "Initialiser K centroïdes", "Affecter au centroïde le plus proche", "Recalculer les centroïdes", "Répéter jusqu'à convergence"];
  const active = [0, 1, 2, 3, 4][[1, 2, 3, 4][st] ?? 0];
  return (
    <Slide n={2} title="1. K-Means : Le principe" sub="Affecter, recalculer, répéter" take="K-Means alterne attribution et recalcul jusqu'à stabilité.">
      <div className="grid md:grid-cols-5 gap-4 h-full">
        <div className="md:col-span-2 flex flex-col gap-2">
          {steps.map((s, i) => (
            <div key={s} className={`flex items-center gap-3 rounded-xl px-3 py-2 border transition-all ${i === active ? "bg-indigo-600 text-white border-indigo-600 scale-[1.02]" : "bg-white border-slate-200 text-slate-600"}`}>
              <span className="font-bold">{i + 1}</span><span className="text-sm">{s}</span>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setSt((st + 1) % 4)} className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 transition">Étape suivante</button>
            <button onClick={() => setSt(0)} className="rounded-xl border border-slate-300 px-3"><RotateCcw size={16} /></button>
          </div>
        </div>
        <Card className="md:col-span-3">
          <div className="flex gap-2 mb-1">{names.map((n, i) => <span key={n} className={`text-xs px-2 py-1 rounded-full ${i === st ? "bg-indigo-100 text-indigo-700 font-semibold" : "bg-slate-100 text-slate-400"}`}>{n}</span>)}</div>
          <Scat h={310} series={series} />
        </Card>
      </div>
    </Slide>
  );
};

const S3 = () => (
  <Slide n={3} title="2. Elbow Method : Combien de clusters choisir ?" sub="Inertia (WCSS) = distance des points à leur centroïde"
    take="plus K augmente, plus l'inertia baisse : on cherche le coude.">
    <div className="grid md:grid-cols-3 gap-4 h-full">
      <div className="flex flex-col gap-3">
        <Card className="text-sm text-slate-600">K-Means exige de fixer <b>K</b> à l'avance. L'inertia diminue toujours quand K grandit.</Card>
        <Card className="bg-emerald-50 border-emerald-200 text-sm text-emerald-900"><Activity size={16} className="inline mr-1" />Le coude indique généralement un bon compromis entre simplicité et qualité du clustering.</Card>
      </div>
      <Card className="md:col-span-2">
        <div style={{ height: 330 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={inertia} margin={{ top: 15, right: 20, left: 0, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="k" label={{ value: "K", position: "insideBottom", offset: -8 }} />
              <YAxis label={{ value: "Inertia / WCSS", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v) => [v, "Inertia"]} labelFormatter={(k) => `K = ${k}`} />
              <Line dataKey="inertia" stroke="#6366f1" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
              <ReferenceDot x={3} y={210} r={12} fill="#10b981" fillOpacity={0.3} stroke="#10b981" strokeWidth={2} label={{ value: "Coude : K = 3", position: "top", fill: "#059669", fontSize: 13 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  </Slide>
);

const S4 = () => {
  const cards = [
    ["Silhouette Score", "sil", "#6366f1", "↑ Plus proche de 1 = mieux", "Cohésion interne vs séparation. ≈1 séparés · ≈0 chevauchement · <0 mauvaise affectation", true],
    ["Davies-Bouldin Index", "db", "#ec4899", "↓ Plus faible = mieux", "Similarité entre clusters : faible = compacts et bien séparés", false],
    ["Calinski-Harabasz Score", "ch", "#10b981", "↑ Plus élevé = mieux", "Dispersion inter-clusters ÷ dispersion intra-cluster", true],
  ];
  return (
    <Slide n={4} title="3. Mesurer la qualité des clusters" sub="Trois métriques, évaluées pour K = 2 à 8" take="chaque métrique mesure la compacité et la séparation autrement.">
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map(([t, k, c, hint, d, up], i) => (
          <Card key={k}>
            <div className="flex items-center gap-2 font-semibold mb-1">{[<Target key="a" size={18} />, <GitBranch key="b" size={18} />, <BarChart3 key="c" size={18} />][i]}{t}</div>
            <div className="inline-block text-xs font-semibold px-2 py-1 rounded-full mb-2" style={{ background: c + "22", color: c }}>{hint}</div>
            <p className="text-xs text-slate-500 mb-2 min-h-[48px]">{d}</p>
            <MiniLine data={M} dk={k} color={c} h={190} bar={k === "ch"} />
          </Card>
        ))}
      </div>
    </Slide>
  );
};

const S5 = () => {
  const [k, setK] = useState(3);
  const row = M.find((m) => m.k === k), best = k === 3;
  const mx = (key) => Math.max(...M.map((m) => m[key])), mn = (key) => Math.min(...M.map((m) => m[key]));
  const norm = M.slice(0, 5).map((m) => ({ k: m.k, Silhouette: +((m.sil - mn("sil")) / (mx("sil") - mn("sil"))).toFixed(2), "Davies-Bouldin (inversé)": +((mx("db") - m.db) / (mx("db") - mn("db"))).toFixed(2), "Calinski-Harabasz": +((m.ch - mn("ch")) / (mx("ch") - mn("ch"))).toFixed(2) }));
  return (
    <Slide n={5} title="4. Comment choisir le meilleur K ?" sub="Ne jamais décider avec une seule métrique" take="croise plusieurs métriques : K = 3 est le meilleur compromis ici.">
      <div className="grid md:grid-cols-2 gap-4 h-full">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((v) => (
              <button key={v} onClick={() => setK(v)} className={`flex-1 rounded-xl py-2 font-semibold border transition ${v === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"}`}>K = {v}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["Silhouette", row.sil, "#6366f1"], ["Davies-Bouldin", row.db, "#ec4899"], ["Calinski-H.", row.ch, "#10b981"]].map(([n, v, c]) => (
              <Card key={n} className="text-center !p-3"><div className="text-xs text-slate-500">{n}</div><div className="text-2xl font-bold" style={{ color: c }}>{v}</div></Card>
            ))}
          </div>
          <div className={`rounded-xl px-4 py-2 text-sm flex items-center gap-2 ${best ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
            {best ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{best ? "Meilleur compromis : toutes les métriques convergent." : "Compromis moins favorable que K = 3."}
          </div>
          <Card className="text-sm space-y-1">
            <div>Elbow → cherche le coude</div><div>Silhouette → cherche une valeur élevée</div>
            <div>Davies-Bouldin → cherche une valeur faible</div><div>Calinski-Harabasz → cherche une valeur élevée</div>
          </Card>
        </div>
        <Card>
          <div className="text-xs text-slate-500 mb-1">Scores normalisés (1 = meilleur)</div>
          <div style={{ height: 330 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={norm} margin={{ left: -15, right: 15, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="k" /><YAxis domain={[0, 1]} />
                <Tooltip labelFormatter={(v) => `K = ${v}`} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="Silhouette" stroke="#6366f1" strokeWidth={2.5} /><Line dataKey="Davies-Bouldin (inversé)" stroke="#ec4899" strokeWidth={2.5} /><Line dataKey="Calinski-Harabasz" stroke="#10b981" strokeWidth={2.5} />
                <ReferenceDot x={k} y={norm.find((n) => n.k === k).Silhouette} r={10} fill="#f59e0b" fillOpacity={0.4} stroke="#f59e0b" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </Slide>
  );
};

const typeStyle = { core: ["Core", 1, "circle"], border: ["Border", 0.4, "diamond"] };
const S6 = () => {
  const [eps, setEps] = useState(1.0), [min, setMin] = useState(5);
  const res = useMemo(() => dbscan(moons, eps, min), [eps, min]);
  const nC = new Set(res.filter((p) => p.c >= 0).map((p) => p.c)).size;
  const series = [
    { name: "Core point", color: C[0], op: 1, shape: "circle", data: res.filter((p) => p.t === "core"), cells: (p) => C[p.c % 4] },
    { name: "Border point", color: C[0], op: 0.45, shape: "diamond", data: res.filter((p) => p.t === "border"), cells: (p) => C[p.c % 4] },
    { name: "Noise", color: "#ef4444", op: 0.9, shape: "cross", data: res.filter((p) => p.t === "noise") },
  ];
  const Sl = ({ label, v, set, mi, ma, st }) => (
    <label className="block text-sm"><span className="font-mono font-semibold">{label} = {v}</span>
      <input type="range" min={mi} max={ma} step={st} value={v} onChange={(e) => set(+e.target.value)} className="w-full accent-indigo-600" /></label>
  );
  return (
    <Slide n={6} title="5. DBSCAN : Clustering basé sur la densité" sub="Density-Based Spatial Clustering of Applications with Noise" take="DBSCAN trouve les zones denses et isole le bruit, sans K.">
      <div className="grid md:grid-cols-5 gap-4 h-full">
        <div className="md:col-span-2 flex flex-col gap-3">
          <Card className="space-y-3"><Sl label="eps" v={eps} set={setEps} mi={0.3} ma={2.5} st={0.1} /><Sl label="min_samples" v={min} set={setMin} mi={2} ma={15} st={1} />
            <div className="text-sm font-semibold text-indigo-700">{nC} cluster(s) · {res.filter((p) => p.t === "noise").length} outlier(s)</div></Card>
          <Card className="text-sm space-y-1.5 text-slate-600">
            <div><b>eps</b> : distance maximale entre voisins</div><div><b>min_samples</b> : voisins requis pour une zone dense</div>
            <div><Circle size={12} className="inline text-indigo-600 fill-indigo-600" /> <b>Core</b> : assez de voisins</div>
            <div><Circle size={12} className="inline text-indigo-300 fill-indigo-300" /> <b>Border</b> : près d'un core, trop peu de voisins</div>
            <div><Circle size={12} className="inline text-red-500" /> <b>Noise</b> : aucun cluster</div>
          </Card>
        </div>
        <Card className="md:col-span-3"><Scat h={350} series={series} /></Card>
      </div>
    </Slide>
  );
};

const S7 = () => {
  const km = useMemo(() => kmeans(moons, [moons[0], moons[1]]), []);
  const db = useMemo(() => dbscan(moons, 0.9, 5), []);
  const rows = [["Type", "Centroid-based", "Density-based"], ["Nombre de clusters", "K obligatoire", "Pas besoin de K"], ["Forme des clusters", "Plutôt sphérique", "Formes arbitraires"], ["Outliers", "Sensible", "Détecte le bruit"], ["Paramètres", "K", "eps + min_samples"], ["Densité variable", "Limité", "Peut être limité"]];
  return (
    <Slide n={7} title="K-Means ou DBSCAN ?" sub="Choisir selon la forme des données" take="K-Means : rapide et simple · DBSCAN : formes irrégulières et outliers.">
      <div className="grid md:grid-cols-5 gap-3 h-full">
        <Card className="md:col-span-2 !p-3">
          <table className="w-full text-xs md:text-sm">
            <thead><tr className="text-left"><th /><th className="text-indigo-600 py-1">K-Means</th><th className="text-emerald-600">DBSCAN</th></tr></thead>
            <tbody>{rows.slice(1).map(([a, b, c]) => <tr key={a} className="border-t border-slate-100"><td className="py-1.5 font-medium text-slate-700">{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
          </table>
          <div className="mt-3 text-xs text-slate-600 space-y-0.5">
            <div>1. K-Means est simple et rapide.</div><div>2. Le choix de K est important.</div><div>3. Les métriques évaluent le clustering.</div>
            <div>4. DBSCAN ne nécessite pas K.</div><div>5. DBSCAN : formes irrégulières et outliers.</div>
          </div>
        </Card>
        <Card className="md:col-span-3 !p-3">
          <div className="grid grid-cols-2 gap-2">
            <div><div className="text-sm font-semibold text-indigo-600 text-center">K-Means (K = 2) : coupe mal les formes</div>
              <Scat h={230} legend={false} series={byLabel(moons, km.l, 2).concat([{ name: "Centroïdes", color: "#0f172a", op: 1, shape: "star", data: km.cs }])} /></div>
            <div><div className="text-sm font-semibold text-emerald-600 text-center">DBSCAN : formes + outliers</div>
              <Scat h={230} legend={false} series={[0, 1].map((i) => ({ name: `Cluster ${i + 1}`, color: C[i], data: db.filter((p) => p.c === i) })).concat([{ name: "Noise", color: "#ef4444", shape: "cross", data: db.filter((p) => p.c === -1) }])} /></div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
            {["Elbow → choisir K", "Silhouette → mesurer la séparation", "Davies-Bouldin → plus faible = mieux", "Calinski-Harabasz → plus élevé = mieux", "DBSCAN → densité + bruit"].map((t) => <span key={t} className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">{t}</span>)}
          </div>
        </Card>
      </div>
    </Slide>
  );
};

/* ---------- Présentation ---------- */
export default function Presentation() {
  const [i, setI] = useState(0);
  const slides = [S1, S2, S3, S4, S5, S6, S7], Cur = slides[i];
  const go = (d) => setI((v) => Math.min(6, Math.max(0, v + d)));
  useEffect(() => {
    const h = (e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const btn = "flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition";
  return (
    <div className="min-h-screen flex flex-col text-slate-800" style={{ fontFamily: "Inter, system-ui, sans-serif", backgroundColor: "#f8fafc", backgroundImage: "linear-gradient(#e2e8f0 1px,transparent 1px),linear-gradient(90deg,#e2e8f0 1px,transparent 1px)", backgroundSize: "32px 32px" }}>
      <style>{`@keyframes sIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}.sIn{animation:sIn .45s ease}`}</style>
      <div className="h-1.5 bg-slate-200"><div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${((i + 1) / 7) * 100}%` }} /></div>
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto"><div key={i} className="sIn h-full"><Cur /></div></main>
      <footer className="flex items-center justify-between gap-2 px-4 md:px-8 py-3 bg-white/80 border-t border-slate-200">
        <button className={btn} disabled={i === 0} onClick={() => go(-1)}><ArrowLeft size={16} /> Précédent</button>
        <div className="flex items-center gap-3">
          <button className={btn} onClick={() => setI(0)} title="Retour au début"><RotateCcw size={14} /></button>
          <div className="hidden sm:flex gap-1.5">{slides.map((_, j) => <button key={j} onClick={() => setI(j)} className={`h-2 rounded-full transition-all ${j === i ? "w-6 bg-indigo-600" : "w-2 bg-slate-300"}`} />)}</div>
          <span className="text-sm font-semibold">Slide {i + 1} / 7</span>
        </div>
        <button className={btn} disabled={i === 6} onClick={() => go(1)}>Suivant <ArrowRight size={16} /></button>
      </footer>
    </div>
  );
}
