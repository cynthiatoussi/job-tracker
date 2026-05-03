'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Download, RefreshCw, ExternalLink, TrendingUp, Award, Briefcase, ClipboardList } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string; title: string; company: string; location: string
  country: string; contrat: string; age: number; desc: string
  tags: string[]; url: string; source: string
}
type SortKey = 'date' | 'relevance' | 'company' | 'title'
type Status  = 'postule' | 'entretien' | 'refus'

// ─── Countries ────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code:'fr', label:'🇫🇷 France' },
  { code:'be', label:'🇧🇪 Belgique' },
  { code:'ch', label:'🇨🇭 Suisse' },
  { code:'lu', label:'🇱🇺 Luxembourg' },
  { code:'gb', label:'🇬🇧 Royaume-Uni' },
  { code:'de', label:'🇩🇪 Allemagne' },
  { code:'nl', label:'🇳🇱 Pays-Bas' },
  { code:'es', label:'🇪🇸 Espagne' },
  { code:'it', label:'🇮🇹 Italie' },
  { code:'at', label:'🇦🇹 Autriche' },
  { code:'pt', label:'🇵🇹 Portugal' },
]

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  fr: ['Paris','Lyon','Bordeaux','Toulouse','Nantes','Lille','Strasbourg','Marseille','Montpellier','Remote'],
  be: ['Bruxelles','Anvers','Gand','Liège','Remote'],
  ch: ['Genève','Zurich','Lausanne','Berne','Remote'],
  lu: ['Luxembourg'],
  gb: ['London','Manchester','Edinburgh','Bristol','Remote'],
  de: ['Berlin','Munich','Hamburg','Frankfurt','Remote'],
  nl: ['Amsterdam','Rotterdam','Utrecht','Remote'],
  es: ['Madrid','Barcelona','Valencia','Remote'],
  it: ['Milan','Rome','Turin','Remote'],
  at: ['Vienna','Graz','Remote'],
  pt: ['Lisbon','Porto','Remote'],
}

// ─── Skills extraction étendue ────────────────────────────────────────────────
const STACK_PATTERNS: Record<string, RegExp[]> = {
  Python:        [/\bpython\b/i],
  SQL:           [/\bsql\b/i, /postgresql/i, /mysql/i, /\bsqlite\b/i],
  Spark:         [/\bspark\b/i, /pyspark/i],
  AWS:           [/\baws\b/i, /amazon web services/i, /sagemaker/i, /\bs3\b/i, /\bec2\b/i, /\blambda\b/i],
  GCP:           [/\bgcp\b/i, /google cloud/i, /bigquery/i, /vertex ai/i, /dataflow/i],
  Azure:         [/\bazure\b/i, /microsoft azure/i, /synapse/i, /azure ml/i],
  Docker:        [/\bdocker\b/i, /conteneur/i, /containeris/i],
  Kubernetes:    [/kubernetes/i, /\bk8s\b/i, /kubeflow/i, /helm\b/i],
  Airflow:       [/airflow/i, /apache airflow/i],
  dbt:           [/\bdbt\b/i, /data build tool/i],
  Kafka:         [/\bkafka\b/i, /apache kafka/i],
  MLflow:        [/mlflow/i],
  TensorFlow:    [/tensorflow/i],
  PyTorch:       [/pytorch/i],
  'scikit-learn':[/scikit.?learn/i, /\bsklearn\b/i],
  Databricks:    [/databricks/i],
  'Power BI':    [/power.?bi/i],
  Tableau:       [/\btableau\b/i],
  Snowflake:     [/snowflake/i],
  FastAPI:       [/fastapi/i],
  LangChain:     [/langchain/i],
  'LLM/GenAI':   [/\bllm\b/i, /genai/i, /generative ai/i, /\brag\b/i, /gpt/i, /langchain/i, /llama/i],
  Looker:        [/\blooker\b/i],
  Scala:         [/\bscala\b/i],
  R:             [/\blanguage r\b/i, /\bR\b(?= pour| studio)/i, /rstudio/i],
  Hadoop:        [/hadoop/i, /hdfs/i, /hive\b/i],
  Terraform:     [/terraform/i],
  Git:           [/\bgit\b/i, /github/i, /gitlab/i],
  Pandas:        [/\bpandas\b/i],
  'NumPy':       [/\bnumpy\b/i],
  Streamlit:     [/streamlit/i],
  'NoSQL':       [/\bmongodb\b/i, /\bcassandra\b/i, /\belasticsearch\b/i, /nosql/i, /redis/i],
}

function analyzeSkills(jobs: Job[]): Record<string, number> {
  const freq: Record<string, number> = {}
  jobs.forEach(j => {
    const text = `${j.title} ${j.desc} ${j.tags.join(' ')}`
    Object.entries(STACK_PATTERNS).forEach(([stack, pats]) => {
      if (pats.some(p => p.test(text))) freq[stack] = (freq[stack] || 0) + 1
    })
  })
  return freq
}

// ─── Certifications ───────────────────────────────────────────────────────────
const CERTS: Record<string, { name: string; provider: string; level: string; time: string; link: string; stack: string; free?: boolean }> = {
  Python:        { stack:'Python',        name:'PCEP — Python Entry-Level',                  provider:'Python Institute',    level:'Débutant',      time:'~2 semaines', link:'https://pythoninstitute.org/pcep' },
  'LLM/GenAI':   { stack:'LLM/GenAI',    name:'LLM Engineering with LangChain',              provider:'DeepLearning.AI',     level:'Intermédiaire', time:'~3 semaines', link:'https://www.deeplearning.ai/courses/', free:true },
  AWS:           { stack:'AWS',           name:'AWS Certified ML Specialty',                  provider:'Amazon Web Services', level:'Avancé',        time:'~3 mois',     link:'https://aws.amazon.com/certification/certified-machine-learning-specialty/' },
  GCP:           { stack:'GCP',           name:'Google Professional Data Engineer',           provider:'Google Cloud',        level:'Avancé',        time:'~2 mois',     link:'https://cloud.google.com/learn/certification/data-engineer' },
  Azure:         { stack:'Azure',         name:'Azure DP-100 Data Scientist Associate',       provider:'Microsoft',           level:'Intermédiaire', time:'~2 mois',     link:'https://learn.microsoft.com/certifications/azure-data-scientist/' },
  Spark:         { stack:'Spark',         name:'Databricks Associate Dev for Spark',          provider:'Databricks',          level:'Intermédiaire', time:'~6 semaines', link:'https://www.databricks.com/learn/certification/apache-spark-developer-associate' },
  Databricks:    { stack:'Databricks',    name:'Databricks Certified ML Associate',           provider:'Databricks',          level:'Intermédiaire', time:'~6 semaines', link:'https://www.databricks.com/learn/certification/machine-learning-associate' },
  Kubernetes:    { stack:'Kubernetes',    name:'CKA — Certified Kubernetes Administrator',    provider:'Linux Foundation',    level:'Avancé',        time:'~3 mois',     link:'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/' },
  dbt:           { stack:'dbt',           name:'dbt Analytics Engineer Certification',        provider:'dbt Labs',            level:'Intermédiaire', time:'~1 mois',     link:'https://www.getdbt.com/certifications/analytics-engineer-certification-exam/' },
  Snowflake:     { stack:'Snowflake',     name:'SnowPro Core Certification',                  provider:'Snowflake',           level:'Intermédiaire', time:'~6 semaines', link:'https://www.snowflake.com/certifications/' },
  TensorFlow:    { stack:'TensorFlow',    name:'TensorFlow Developer Certificate',            provider:'Google',              level:'Intermédiaire', time:'~2 mois',     link:'https://www.tensorflow.org/certificate' },
  Docker:        { stack:'Docker',        name:'Docker Certified Associate',                  provider:'Docker Inc.',         level:'Intermédiaire', time:'~6 semaines', link:'https://training.mirantis.com/certification/dca-certification-exam/' },
  'Power BI':    { stack:'Power BI',      name:'PL-300 Microsoft Power BI Data Analyst',      provider:'Microsoft',           level:'Intermédiaire', time:'~6 semaines', link:'https://learn.microsoft.com/certifications/power-bi-data-analyst-associate/' },
  SQL:           { stack:'SQL',           name:'SQL for Data Science (Coursera)',              provider:'UC Davis / Coursera', level:'Débutant',      time:'~3 semaines', link:'https://www.coursera.org/learn/sql-for-data-science', free:true },
  Terraform:     { stack:'Terraform',     name:'HashiCorp Terraform Associate',               provider:'HashiCorp',           level:'Intermédiaire', time:'~1 mois',     link:'https://developer.hashicorp.com/certifications/infrastructure-automation' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ageLabel(age: number) {
  if (age === 0) return "Aujourd'hui"
  if (age === 1) return 'Hier'
  return `Il y a ${age} j.`
}

function applySort(jobs: Job[], sort: SortKey, query: string): Job[] {
  const c = [...jobs]
  if (sort === 'date')    return c.sort((a,b) => a.age-b.age)
  if (sort === 'company') return c.sort((a,b) => a.company.localeCompare(b.company))
  if (sort === 'title')   return c.sort((a,b) => a.title.localeCompare(b.title))
  const words = query.toLowerCase().split(/\s+/)
  return c.sort((a,b) => {
    const s = (j: Job) => words.reduce((n,w)=>n+(j.title.toLowerCase().includes(w)?1:0),0)
    return s(b)-s(a)
  })
}

function exportCSV(jobs: Job[], statuses: Record<string,Status>) {
  const h = ['Titre','Entreprise','Ville','Pays','Contrat','Age (j)','Source','Statut','URL']
  const r = jobs.map(j => [j.title, j.company, j.location, j.country, j.contrat, j.age, j.source, statuses[j.id]||'', j.url])
  const csv = [h,...r].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const a = Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})),
    download:`offres_data_${new Date().toISOString().slice(0,10)}.csv`
  })
  a.click()
}

function contratClass(c: string) {
  if (c==='Alternance') return 'contrat-alternance'
  if (c==='Stage')      return 'contrat-stage'
  if (c==='Graduate')   return 'contrat-graduate'
  return 'contrat-cdi'
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab]                 = useState<'offres'|'stacks'|'certifs'|'tracker'>('offres')
  const [jobs, setJobs]               = useState<Job[]>([])
  const [filtered, setFiltered]       = useState<Job[]>([])
  const [loading, setLoading]         = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]             = useState<string|null>(null)
  const [query, setQuery]             = useState('data')
  const [country, setCountry]         = useState('fr')
  const [ville, setVille]             = useState('')
  const [contrat, setContrat]         = useState('')
  const [sort, setSort]               = useState<SortKey>('date')
  const [page, setPage]               = useState(1)
  const [hasMore, setHasMore]         = useState(true)
  const [total, setTotal]             = useState(0)
  const [skillFreq, setSkillFreq]     = useState<Record<string,number>>({})
  const [statuses, setStatuses]       = useState<Record<string,Status>>({})
  const [trackedJobs, setTrackedJobs] = useState<Record<string,Job>>({})

  // Load from localStorage
  useEffect(() => {
    try {
      const s = localStorage.getItem('djt_statuses')
      const t = localStorage.getItem('djt_tracked')
      if (s) setStatuses(JSON.parse(s))
      if (t) setTrackedJobs(JSON.parse(t))
    } catch {}
  }, [])

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('djt_statuses', JSON.stringify(statuses))
      localStorage.setItem('djt_tracked', JSON.stringify(trackedJobs))
    } catch {}
  }, [statuses, trackedJobs])

  // Reset ville when country changes
  useEffect(() => { setVille('') }, [country])

  useEffect(() => {
    let r = [...jobs]
    if (ville)   r = r.filter(j => j.location.toLowerCase().includes(ville.toLowerCase()))
    if (contrat) r = r.filter(j => j.contrat === contrat)
    r = applySort(r, sort, query)
    setFiltered(r)
    setSkillFreq(analyzeSkills(r))
  }, [jobs, ville, contrat, sort, query])

  const fetchJobs = useCallback(async (p=1, append=false) => {
    p===1 ? setLoading(true) : setLoadingMore(true)
    setError(null)
    try {
      const params = new URLSearchParams({ what:query, page:String(p), per_page:'20', country, contrat })
      const res  = await fetch(`/api/jobs?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const newJobs: Job[] = (data.results||[]).map((j:any):Job=>({
        id:       String(j.id??Math.random()),
        title:    String(j.title??'—'),
        company:  String(j.company??'—'),
        location: String(j.location??'—'),
        country:  String(j.country??country.toUpperCase()),
        contrat:  String(j.contrat??'CDI'),
        age:      Number(j.age??0),
        desc:     String(j.desc??''),
        tags:     Array.isArray(j.tags)?j.tags:[],
        url:      String(j.url??'#'),
        source:   String(j.source??'Adzuna'),
      }))
      setJobs(prev => append ? [...prev,...newJobs] : newJobs)
      setHasMore(newJobs.length>=20)
      setPage(p)
      setTotal(Number(data.count)||0)
    } catch(e:any) { setError(String(e.message)) }
    finally { setLoading(false); setLoadingMore(false) }
  }, [query, country, contrat])

  useEffect(() => { fetchJobs(1) }, [])

  const setStatus = (job: Job, status: Status) => {
    setStatuses(prev => {
      const next = {...prev}
      if (next[job.id]===status) { delete next[job.id]; return next }
      next[job.id] = status
      return next
    })
    setTrackedJobs(prev => ({ ...prev, [job.id]: job }))
  }

  const removeTracked = (id: string) => {
    setStatuses(prev => { const n={...prev}; delete n[id]; return n })
    setTrackedJobs(prev => { const n={...prev}; delete n[id]; return n })
  }

  const newCount     = jobs.filter(j=>j.age<=1).length
  const sortedSkills = Object.entries(skillFreq).sort((a,b)=>b[1]-a[1])
  const topCerts     = [
    ...sortedSkills.filter(([k])=>CERTS[k]).map(([k])=>CERTS[k]),
    ...Object.values(CERTS).filter(c=>!sortedSkills.find(([k])=>k===c.stack)),
  ].slice(0,14)

  const trackedList  = Object.entries(statuses)
  const cities       = CITIES_BY_COUNTRY[country] || []

  const statusLabel: Record<Status,string> = { postule:'✅ Postulé', entretien:'🟡 Entretien', refus:'❌ Refus' }
  const statusClass: Record<Status,string> = { postule:'s-postule', entretien:'s-entretien', refus:'s-refus' }
  const dotClass:    Record<Status,string> = { postule:'dot-postule', entretien:'dot-entretien', refus:'dot-refus' }

  return (
    <div>
      <header className="header">
        <div className="brand">
          <div className="brand-dot" />
          DataJob Tracker
          {newCount > 0 && <span className="new-badge">+{newCount} nouvelles</span>}
          {trackedList.length > 0 && <span className="new-badge" style={{background:'#4ade80',color:'#0a0f1e'}}>{trackedList.length} suivies</span>}
        </div>
        <nav className="nav">
          {(['offres','stacks','certifs','tracker'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} className={`nav-btn${tab===t?' active':''}`}>
              {t==='offres'  ? <><Briefcase    size={12}/>Offres</>
               :t==='stacks' ? <><TrendingUp   size={12}/>Skills</>
               :t==='certifs'? <><Award        size={12}/>Certifs</>
               :               <><ClipboardList size={12}/>Tracker</>}
            </button>
          ))}
        </nav>
      </header>

      <div className="container">

        {/* ── OFFRES ── */}
        {tab==='offres' && <>
          <div className="search-row">
            <div className="search-wrap">
              <Search size={14} className="search-icon" />
              <input value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&fetchJobs(1)}
                placeholder="ex: data scientist, MLOps, alternance data..."
                className="search-input" />
            </div>
            <button onClick={()=>fetchJobs(1)} disabled={loading} className="btn-search">
              <RefreshCw size={13} className={loading?'spin':''} />
              {loading?'Chargement…':'Rechercher'}
            </button>
          </div>

          <div className="filter-row">
            <select value={country} onChange={e=>{setCountry(e.target.value);setVille('')}} className="select">
              {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <select value={ville} onChange={e=>setVille(e.target.value)} className="select">
              <option value="">Toutes villes</option>
              {cities.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
            <select value={contrat} onChange={e=>setContrat(e.target.value)} className="select">
              <option value="">Tous contrats</option>
              {['CDI','Alternance','Stage','Graduate'].map(v=><option key={v} value={v}>{v}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value as SortKey)} className="select">
              <option value="date">Date (récent)</option>
              <option value="relevance">Pertinence</option>
              <option value="company">Entreprise A–Z</option>
              <option value="title">Intitulé A–Z</option>
            </select>
            <div className="spacer" />
            <button onClick={()=>exportCSV(filtered,statuses)} className="btn-csv">
              <Download size={12}/> CSV
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-val">{total.toLocaleString('fr-FR')}</div><div className="stat-label">offres dispo</div></div>
            <div className="stat-card"><div className="stat-val">{jobs.length}</div><div className="stat-label">chargées</div></div>
            <div className="stat-card"><div className="stat-val">{filtered.length}</div><div className="stat-label">après filtres</div></div>
            <div className="stat-card"><div className="stat-val amber">{newCount}</div><div className="stat-label">nouvelles 48h</div></div>
          </div>

          {error && <div className="error-box">{error}</div>}

          {loading ? <div className="empty">Chargement des offres…</div>
           : filtered.length===0 ? <div className="empty">Aucune offre pour ces filtres.</div>
           : <>
              <div className="jobs-list">
                {filtered.map(j => {
                  const st = statuses[j.id]
                  const cardCls = `job-card${j.age<=1&&!st?' is-new':''} ${st===('applied' as any)||st==='postule'?' applied':''} ${st==='entretien'?' interview':''} ${st==='refus'?' rejected':''}`
                  return (
                    <div key={j.id} className={cardCls}>
                      <div className="job-header">
                        <div className="job-title">{j.title}</div>
                        <div className="job-age-wrap">
                          {j.age<=1&&!st && <span className="new-pill">nouveau</span>}
                          <span className="job-age">{ageLabel(j.age)}</span>
                        </div>
                      </div>
                      <div className="job-meta">
                        {j.company} · {j.location} · {j.country} · <span className={contratClass(j.contrat)}><b>{j.contrat}</b></span>
                      </div>
                      {j.desc && <div className="job-desc">{j.desc}</div>}
                      <div className="job-footer">
                        <div className="status-row">
                          {(['postule','entretien','refus'] as Status[]).map(s=>(
                            <button key={s} onClick={()=>setStatus(j,s)}
                              className={`status-btn${st===s?` active-${s}`:''}`}>
                              {s==='postule'?'✅ Postulé':s==='entretien'?'🟡 Entretien':'❌ Refus'}
                            </button>
                          ))}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <span className={`job-source${j.source!=='Adzuna'?' external':''}`}>{j.source}</span>
                          <a href={j.url} target="_blank" rel="noopener noreferrer" className="btn-apply">
                            Postuler <ExternalLink size={11}/>
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {hasMore && (
                <button onClick={()=>fetchJobs(page+1,true)} disabled={loadingMore} className="btn-more">
                  {loadingMore
                    ? <><RefreshCw size={13} className="spin"/>Chargement…</>
                    : `Charger 20 de plus (${Math.max(0,total-jobs.length).toLocaleString('fr-FR')} restantes)`}
                </button>
              )}
            </>}
        </>}

        {/* ── SKILLS ── */}
        {tab==='stacks' && <>
          <p className="section-title">Skills les plus demandées · {filtered.length} offres analysées</p>
          {sortedSkills.length===0
            ? <div className="empty">Lance une recherche pour analyser les skills.</div>
            : <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {sortedSkills.slice(0,25).map(([s,c])=>(
                  <div key={s} className="stack-row">
                    <span className="stack-name">{s}</span>
                    <div className="stack-bar-bg">
                      <div className="stack-bar-fill" style={{width:`${Math.round(c/sortedSkills[0][1]*100)}%`}}/>
                    </div>
                    <span className="stack-count">{c}</span>
                    <span className="stack-pct">{filtered.length>0?Math.round(c/filtered.length*100):0}%</span>
                  </div>
                ))}
              </div>}
        </>}

        {/* ── CERTIFS ── */}
        {tab==='certifs' && <>
          <p className="section-title">Certifications recommandées · basées sur les skills du marché</p>
          {topCerts.length===0
            ? <div className="empty">Lance une recherche pour voir les certifs recommandées.</div>
            : <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {topCerts.map((cert,i)=>{
                  const freq = skillFreq[cert.stack]||0
                  const lc = `level-badge level-${cert.level.toLowerCase()}`
                  return (
                    <div key={cert.stack} className="cert-card">
                      <div className={`cert-rank${i<3?' top':''}`}>{i+1}</div>
                      <div className="cert-info">
                        <div className="cert-name">
                          {cert.name}
                          {cert.free && <span style={{marginLeft:'6px',fontSize:'10px',background:'rgba(74,222,128,0.15)',color:'#4ade80',padding:'1px 6px',borderRadius:'4px',border:'1px solid rgba(74,222,128,0.3)'}}>Gratuit</span>}
                        </div>
                        <div className="cert-provider">{cert.provider} · <code style={{fontSize:'11px'}}>{cert.stack}</code></div>
                        <div className="cert-meta">
                          <span className={lc}>{cert.level}</span>
                          <span className="cert-time">{cert.time}</span>
                          {freq>0 && <span className="cert-freq">citée dans {freq} offres</span>}
                        </div>
                      </div>
                      <a href={cert.link} target="_blank" rel="noopener noreferrer" className="cert-link">Voir →</a>
                    </div>
                  )
                })}
              </div>}
        </>}

        {/* ── TRACKER ── */}
        {tab==='tracker' && <>
          <div className="tracker-stats">
            <div className="tracker-stat"><div className="num t-blue">{trackedList.length}</div><div className="lbl">total suivies</div></div>
            <div className="tracker-stat"><div className="num t-green">{trackedList.filter(([,s])=>s==='postule').length}</div><div className="lbl">postulées</div></div>
            <div className="tracker-stat"><div className="num t-amber">{trackedList.filter(([,s])=>s==='entretien').length}</div><div className="lbl">entretiens</div></div>
            <div className="tracker-stat"><div className="num t-red">{trackedList.filter(([,s])=>s==='refus').length}</div><div className="lbl">refus</div></div>
          </div>

          {trackedList.length===0
            ? <div className="tracker-empty">
                <p style={{fontSize:'32px',marginBottom:'12px'}}>📋</p>
                <p>Aucune candidature suivie.</p>
                <p style={{fontSize:'12px',color:'#334155',marginTop:'6px'}}>Clique sur ✅ Postulé sur une offre pour l'ajouter ici.</p>
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {trackedList.map(([id,status])=>{
                  const job = trackedJobs[id]
                  if (!job) return null
                  return (
                    <div key={id} className="tracker-job">
                      <div className={`tracker-dot ${dotClass[status]}`}/>
                      <div className="tracker-info">
                        <div className="tracker-title">{job.title}</div>
                        <div className="tracker-meta">{job.company} · {job.location} · {job.country} · {job.contrat}</div>
                      </div>
                      <span className={`tracker-status ${statusClass[status]}`}>{statusLabel[status]}</span>
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-apply" style={{padding:'3px 8px'}}>
                        <ExternalLink size={11}/>
                      </a>
                      <button onClick={()=>removeTracked(id)} className="btn-remove" title="Supprimer">×</button>
                    </div>
                  )
                })}
              </div>}
        </>}

      </div>
    </div>
  )
}
