'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Search, Download, RefreshCw, ExternalLink, TrendingUp, Award, Briefcase, ClipboardList } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Job {
  id: string; title: string; company: string; location: string
  country: string; contrat: string; age: number; desc: string
  tags: string[]; url: string; source: string
}
type SortKey = 'date' | 'relevance' | 'company' | 'title'
type Status  = 'postule' | 'entretien' | 'refus'

const COUNTRIES = [
  { code:'fr', label:'🇫🇷 France' }, { code:'be', label:'🇧🇪 Belgique' },
  { code:'ch', label:'🇨🇭 Suisse' }, { code:'lu', label:'🇱🇺 Luxembourg' },
  { code:'gb', label:'🇬🇧 Royaume-Uni' }, { code:'de', label:'🇩🇪 Allemagne' },
  { code:'nl', label:'🇳🇱 Pays-Bas' }, { code:'es', label:'🇪🇸 Espagne' },
  { code:'it', label:'🇮🇹 Italie' }, { code:'at', label:'🇦🇹 Autriche' },
  { code:'pt', label:'🇵🇹 Portugal' },
]

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  fr: ['Paris','Lyon','Bordeaux','Toulouse','Nantes','Lille','Strasbourg','Marseille','Montpellier','Remote'],
  be: ['Bruxelles','Anvers','Gand','Liège','Remote'],
  ch: ['Genève','Zurich','Lausanne','Berne','Remote'],
  lu: ['Luxembourg'], gb: ['London','Manchester','Edinburgh','Bristol','Remote'],
  de: ['Berlin','Munich','Hamburg','Frankfurt','Remote'],
  nl: ['Amsterdam','Rotterdam','Utrecht','Remote'],
  es: ['Madrid','Barcelona','Valencia','Remote'],
  it: ['Milan','Rome','Turin','Remote'],
  at: ['Vienna','Graz','Remote'], pt: ['Lisbon','Porto','Remote'],
}

const STACK_PATTERNS: Record<string, RegExp[]> = {
  Python: [/\bpython\b/i], SQL: [/\bsql\b/i, /postgresql/i, /mysql/i],
  Spark: [/\bspark\b/i, /pyspark/i], AWS: [/\baws\b/i, /sagemaker/i],
  GCP: [/\bgcp\b/i, /google cloud/i, /bigquery/i, /vertex/i],
  Azure: [/\bazure\b/i, /synapse/i], Docker: [/\bdocker\b/i],
  Kubernetes: [/kubernetes/i, /\bk8s\b/i], Airflow: [/airflow/i],
  dbt: [/\bdbt\b/i], Kafka: [/\bkafka\b/i], MLflow: [/mlflow/i],
  TensorFlow: [/tensorflow/i], PyTorch: [/pytorch/i],
  'scikit-learn': [/scikit.?learn/i, /\bsklearn\b/i],
  Databricks: [/databricks/i], 'Power BI': [/power.?bi/i],
  Tableau: [/\btableau\b/i], Snowflake: [/snowflake/i],
  'LLM/GenAI': [/\bllm\b/i, /genai/i, /\brag\b/i, /gpt/i, /langchain/i],
  FastAPI: [/fastapi/i], Terraform: [/terraform/i],
  Git: [/\bgit\b/i, /github/i, /gitlab/i],
  Pandas: [/\bpandas\b/i], Streamlit: [/streamlit/i],
  NoSQL: [/mongodb/i, /elasticsearch/i, /\bredis\b/i, /nosql/i],
  Scala: [/\bscala\b/i], Hadoop: [/hadoop/i, /hdfs/i],
  Bloomberg: [/bloomberg/i], VBA: [/\bvba\b/i], Excel: [/\bexcel\b/i],
  SAP: [/\bsap\b/i], R: [/\brstudio\b/i, /\blanguage r\b/i],
}

function analyzeSkills(jobs: Job[]): Record<string, number> {
  const freq: Record<string, number> = {}
  jobs.forEach(j => {
    const text = `${j.title} ${j.desc}`
    Object.entries(STACK_PATTERNS).forEach(([s, pats]) => {
      if (pats.some(p => p.test(text))) freq[s] = (freq[s] || 0) + 1
    })
  })
  return freq
}

const CERTS: Record<string, { name: string; provider: string; level: string; time: string; link: string; stack: string; free?: boolean }> = {
  Python:      { stack:'Python',      name:'PCEP — Python Entry-Level',               provider:'Python Institute',    level:'Débutant',      time:'~2 semaines', link:'https://pythoninstitute.org/pcep' },
  'LLM/GenAI': { stack:'LLM/GenAI',  name:'LLM Engineering with LangChain',           provider:'DeepLearning.AI',     level:'Intermédiaire', time:'~3 semaines', link:'https://www.deeplearning.ai/courses/', free:true },
  AWS:         { stack:'AWS',         name:'AWS Certified ML Specialty',               provider:'Amazon Web Services', level:'Avancé',        time:'~3 mois',     link:'https://aws.amazon.com/certification/certified-machine-learning-specialty/' },
  GCP:         { stack:'GCP',         name:'Google Professional Data Engineer',        provider:'Google Cloud',        level:'Avancé',        time:'~2 mois',     link:'https://cloud.google.com/learn/certification/data-engineer' },
  Azure:       { stack:'Azure',       name:'Azure DP-100 Data Scientist Associate',    provider:'Microsoft',           level:'Intermédiaire', time:'~2 mois',     link:'https://learn.microsoft.com/certifications/azure-data-scientist/' },
  Spark:       { stack:'Spark',       name:'Databricks Associate Dev for Spark',       provider:'Databricks',          level:'Intermédiaire', time:'~6 semaines', link:'https://www.databricks.com/learn/certification/apache-spark-developer-associate' },
  Databricks:  { stack:'Databricks',  name:'Databricks Certified ML Associate',        provider:'Databricks',          level:'Intermédiaire', time:'~6 semaines', link:'https://www.databricks.com/learn/certification/machine-learning-associate' },
  Kubernetes:  { stack:'Kubernetes',  name:'CKA — Certified Kubernetes Administrator', provider:'Linux Foundation',    level:'Avancé',        time:'~3 mois',     link:'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/' },
  dbt:         { stack:'dbt',         name:'dbt Analytics Engineer Certification',     provider:'dbt Labs',            level:'Intermédiaire', time:'~1 mois',     link:'https://www.getdbt.com/certifications/analytics-engineer-certification-exam/' },
  Snowflake:   { stack:'Snowflake',   name:'SnowPro Core Certification',               provider:'Snowflake',           level:'Intermédiaire', time:'~6 semaines', link:'https://www.snowflake.com/certifications/' },
  TensorFlow:  { stack:'TensorFlow',  name:'TensorFlow Developer Certificate',         provider:'Google',              level:'Intermédiaire', time:'~2 mois',     link:'https://www.tensorflow.org/certificate' },
  Docker:      { stack:'Docker',      name:'Docker Certified Associate',               provider:'Docker Inc.',         level:'Intermédiaire', time:'~6 semaines', link:'https://training.mirantis.com/certification/dca-certification-exam/' },
  'Power BI':  { stack:'Power BI',    name:'PL-300 Microsoft Power BI Data Analyst',   provider:'Microsoft',           level:'Intermédiaire', time:'~6 semaines', link:'https://learn.microsoft.com/certifications/power-bi-data-analyst-associate/' },
  SQL:         { stack:'SQL',         name:'SQL for Data Science',                     provider:'UC Davis / Coursera', level:'Débutant',      time:'~3 semaines', link:'https://www.coursera.org/learn/sql-for-data-science', free:true },
  Bloomberg:   { stack:'Bloomberg',   name:'Bloomberg Market Concepts (BMC)',           provider:'Bloomberg',           level:'Débutant',      time:'~8 heures',   link:'https://www.bloomberg.com/professional/product/bloomberg-market-concepts/', free:true },
  VBA:         { stack:'VBA',         name:'Excel VBA — Microsoft Office Specialist',  provider:'Microsoft',           level:'Intermédiaire', time:'~1 mois',     link:'https://learn.microsoft.com/certifications/mos-excel-2019/' },
  R:           { stack:'R',           name:'Data Analysis with R',                     provider:'Duke / Coursera',     level:'Débutant',      time:'~4 semaines', link:'https://www.coursera.org/specializations/statistics', free:true },
}

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
    const s = (j:Job) => words.reduce((n,w)=>n+(j.title.toLowerCase().includes(w)?1:0),0)
    return s(b)-s(a)
  })
}

function exportCSV(jobs: Job[], statuses: Record<string,Status>) {
  const h = ['Titre','Entreprise','Ville','Pays','Contrat','Age (j)','Source','Statut','URL']
  const r = jobs.map(j=>[j.title,j.company,j.location,j.country,j.contrat,j.age,j.source,statuses[j.id]||'',j.url])
  const csv = [h,...r].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const a = Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})),
    download:`offres_data_${new Date().toISOString().slice(0,10)}.csv`
  })
  a.click()
}

function contratClass(c:string) {
  if (c==='Alternance') return 'contrat-alternance'
  if (c==='Stage')      return 'contrat-stage'
  if (c==='Graduate')   return 'contrat-graduate'
  return 'contrat-cdi'
}

export default function Home() {
  const [tab, setTab]                     = useState<'offres'|'stacks'|'certifs'|'tracker'>('offres')
  const [trackerFilter, setTrackerFilter] = useState<'all'|Status>('all')
  const [jobs, setJobs]                   = useState<Job[]>([])
  const [filtered, setFiltered]           = useState<Job[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadingMore, setLoadingMore]     = useState(false)
  const [error, setError]                 = useState<string|null>(null)
  const [query, setQuery]                 = useState('data')
  const [country, setCountry]             = useState('fr')
  const [ville, setVille]                 = useState('')
  const [contrat, setContrat]             = useState('')
  const [sort, setSort]                   = useState<SortKey>('date')
  const [page, setPage]                   = useState(1)
  const [hasMore, setHasMore]             = useState(true)
  const [total, setTotal]                 = useState(0)
  const [skillFreq, setSkillFreq]         = useState<Record<string,number>>({})
  const [statuses, setStatuses]           = useState<Record<string,Status>>({})
  const [trackedJobs, setTrackedJobs]     = useState<Record<string,Job>>({})
  const [syncMsg, setSyncMsg]             = useState('')

  // Charger depuis Supabase au démarrage
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('candidatures').select('*')
      if (!data) return
      const st: Record<string,Status> = {}
      const tj: Record<string,Job>    = {}
      data.forEach((row:any) => {
        st[row.id] = row.status as Status
        tj[row.id] = {
          id:row.id, title:row.title, company:row.company,
          location:row.location, country:row.country,
          contrat:row.contrat, age:row.age,
          desc:'', tags:[], url:row.url, source:row.source,
        }
      })
      setStatuses(st)
      setTrackedJobs(tj)
    }
    load()
  }, [])

  // Correspondance par titre+entreprise pour retrouver les statuts
  // même si l'ID a changé entre deux sessions
  const statusByMatch = useMemo(() => {
    const map: Record<string, Status> = {}
    Object.entries(trackedJobs).forEach(([id, job]) => {
      if (statuses[id]) {
        const key = `${job.title.trim()}|${job.company.trim()}`
        map[key] = statuses[id]
      }
    })
    return map
  }, [trackedJobs, statuses])

  const getStatus = (job: Job): Status | undefined =>
    statuses[job.id] ||
    statusByMatch[`${job.title.trim()}|${job.company.trim()}`]

  useEffect(() => { setVille('') }, [country])

  useEffect(() => {
    let r = [...jobs]
    if (ville)   r = r.filter(j=>j.location.toLowerCase().includes(ville.toLowerCase()))
    if (contrat) r = r.filter(j=>j.contrat===contrat)
    r = applySort(r, sort, query)
    setFiltered(r)
    setSkillFreq(analyzeSkills(r))
  }, [jobs, ville, contrat, sort, query])

  const fetchJobs = useCallback(async (p=1, append=false) => {
    p===1 ? setLoading(true) : setLoadingMore(true)
    setError(null)
    try {
      const params = new URLSearchParams({what:query, page:String(p), per_page:'20', country, contrat})
      const res  = await fetch(`/api/jobs?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const newJobs: Job[] = (data.results||[]).map((j:any):Job=>({
        id:       String(j.id ?? Math.random()),
        title:    String(j.title ?? '—'),
        company:  String(j.company ?? '—'),
        location: String(j.location ?? '—'),
        country:  String(j.country ?? country.toUpperCase()),
        contrat:  String(j.contrat ?? 'CDI'),
        age:      Number(j.age ?? 0),
        desc:     String(j.desc ?? ''),
        tags:     Array.isArray(j.tags) ? j.tags : [],
        url:      String(j.url ?? '#'),
        source:   String(j.source ?? 'Adzuna'),
      }))

      setJobs(prev => {
        const all = append ? [...prev, ...newJobs] : newJobs
        const seen = new Set<string>()
        const unique = all.filter(j => {
          if (seen.has(j.id)) return false
          seen.add(j.id)
          return true
        })
        setHasMore(unique.length < (Number(data.count) || 0))
        return unique
      })
      setPage(p)
      setTotal(Number(data.count) || 0)
    } catch(e:any) { setError(String(e.message)) }
    finally { setLoading(false); setLoadingMore(false) }
  }, [query, country, contrat])

  useEffect(() => { fetchJobs(1) }, [])

  const setStatus = async (job: Job, newStatus: Status) => {
    const currentStatus = getStatus(job)
    const isRemoving = currentStatus === newStatus

    if (isRemoving) {
      // Supprimer par ID et par correspondance titre+entreprise
      await supabase.from('candidatures').delete().eq('id', job.id)
      // Supprimer aussi l'éventuel ancien enregistrement avec titre+company
      const matchKey = `${job.title.trim()}|${job.company.trim()}`
      const oldId = Object.entries(trackedJobs).find(([,tj]) =>
        `${tj.title.trim()}|${tj.company.trim()}` === matchKey
      )?.[0]
      if (oldId && oldId !== job.id) {
        await supabase.from('candidatures').delete().eq('id', oldId)
        setStatuses(prev => { const n={...prev}; delete n[oldId]; return n })
        setTrackedJobs(prev => { const n={...prev}; delete n[oldId]; return n })
      }
      setStatuses(prev => { const n={...prev}; delete n[job.id]; return n })
      setTrackedJobs(prev => { const n={...prev}; delete n[job.id]; return n })
    } else {
      await supabase.from('candidatures').upsert({
        id:job.id, title:job.title, company:job.company,
        location:job.location, country:job.country,
        contrat:job.contrat, url:job.url, source:job.source,
        age:job.age, status:newStatus, updated_at:new Date().toISOString()
      })
      setStatuses(prev => ({...prev, [job.id]:newStatus}))
      setTrackedJobs(prev => ({...prev, [job.id]:job}))
      setSyncMsg('✅ Sauvegardé')
      setTimeout(() => setSyncMsg(''), 2000)
    }
  }

  const removeTracked = async (id: string) => {
    await supabase.from('candidatures').delete().eq('id', id)
    setStatuses(prev => { const n={...prev}; delete n[id]; return n })
    setTrackedJobs(prev => { const n={...prev}; delete n[id]; return n })
  }

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from('candidatures').update({status, updated_at:new Date().toISOString()}).eq('id', id)
    setStatuses(prev => ({...prev, [id]:status}))
  }

  const newCount     = jobs.filter(j=>j.age<=1).length
  const sortedSkills = Object.entries(skillFreq).sort((a,b)=>b[1]-a[1])
  const topCerts     = [
    ...sortedSkills.filter(([k])=>CERTS[k]).map(([k])=>CERTS[k]),
    ...Object.values(CERTS).filter(c=>!sortedSkills.find(([k])=>k===c.stack)),
  ].slice(0,16)

  const trackedList     = Object.entries(statuses)
  const filteredTracker = trackerFilter==='all' ? trackedList : trackedList.filter(([,s])=>s===trackerFilter)
  const cities          = CITIES_BY_COUNTRY[country] || []

  const statusLabel: Record<Status,string> = { postule:'✅ Postulé', entretien:'🟡 Entretien', refus:'❌ Refus' }
  const statusClass: Record<Status,string> = { postule:'s-postule', entretien:'s-entretien', refus:'s-refus' }
  const dotClass:    Record<Status,string> = { postule:'dot-postule', entretien:'dot-entretien', refus:'dot-refus' }

  return (
    <div>
      <header className="header">
        <div className="brand">
          <div className="brand-dot"/>
          DataJob Tracker
          {newCount>0 && <span className="new-badge">+{newCount} nouvelles</span>}
          {trackedList.length>0 && <span className="new-badge" style={{background:'#4ade80',color:'#0a0f1e'}}>{trackedList.length} suivies</span>}
          {syncMsg && <span style={{fontSize:'11px',color:'#4ade80'}}>{syncMsg}</span>}
        </div>
        <nav className="nav">
          {(['offres','stacks','certifs','tracker'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`nav-btn${tab===t?' active':''}`}>
              {t==='offres'   ? <><Briefcase     size={12}/>Offres</>
               :t==='stacks'  ? <><TrendingUp    size={12}/>Skills</>
               :t==='certifs' ? <><Award         size={12}/>Certifs</>
               :                <><ClipboardList size={12}/>Tracker</>}
            </button>
          ))}
        </nav>
      </header>

      <div className="container">

        {tab==='offres' && <>
          <div className="search-row">
            <div className="search-wrap">
              <Search size={14} className="search-icon"/>
              <input value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&fetchJobs(1)}
                placeholder="ex: data scientist, MLOps, alternance data..."
                className="search-input"/>
            </div>
            <button onClick={()=>fetchJobs(1)} disabled={loading} className="btn-search">
              <RefreshCw size={13} className={loading?'spin':''}/>
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
            <div className="spacer"/>
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
                {filtered.map((j, idx) => {
                  const st = getStatus(j)
                  const cardCls = [
                    'job-card',
                    j.age<=1&&!st ? 'is-new' : '',
                    st==='postule'   ? 'applied'   : '',
                    st==='entretien' ? 'interview'  : '',
                    st==='refus'     ? 'rejected'   : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <div key={`${j.id}_${idx}`} className={cardCls}>
                      <div className="job-header">
                        <div className="job-title">{j.title}</div>
                        <div className="job-age-wrap">
                          {j.age<=1&&!st && <span className="new-pill">nouveau</span>}
                          {st && <span className={`tracker-status ${statusClass[st]}`} style={{fontSize:'10px',padding:'2px 6px'}}>{statusLabel[st]}</span>}
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

        {tab==='certifs' && <>
          <p className="section-title">Certifications recommandées · basées sur les skills du marché</p>
          {topCerts.length===0
            ? <div className="empty">Lance une recherche pour voir les certifs.</div>
            : <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {topCerts.map((cert,i)=>{
                  const freq = skillFreq[cert.stack]||0
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
                          <span className={`level-badge level-${cert.level.toLowerCase()}`}>{cert.level}</span>
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

        {tab==='tracker' && <>
          <div className="tracker-stats">
            <div className="tracker-stat"><div className="num t-blue">{trackedList.length}</div><div className="lbl">total</div></div>
            <div className="tracker-stat"><div className="num t-green">{trackedList.filter(([,s])=>s==='postule').length}</div><div className="lbl">postulées</div></div>
            <div className="tracker-stat"><div className="num t-amber">{trackedList.filter(([,s])=>s==='entretien').length}</div><div className="lbl">entretiens</div></div>
            <div className="tracker-stat"><div className="num t-red">{trackedList.filter(([,s])=>s==='refus').length}</div><div className="lbl">refus</div></div>
          </div>

          <div style={{display:'flex',gap:'6px',marginBottom:'16px',flexWrap:'wrap'}}>
            {(['all','postule','entretien','refus'] as const).map(f=>(
              <button key={f} onClick={()=>setTrackerFilter(f)}
                style={{padding:'5px 14px',borderRadius:'8px',border:'1px solid',cursor:'pointer',fontSize:'12px',fontWeight:500,
                  background: trackerFilter===f ? (f==='postule'?'rgba(74,222,128,0.15)':f==='entretien'?'rgba(245,158,11,0.15)':f==='refus'?'rgba(248,113,113,0.15)':'rgba(14,165,233,0.15)') : 'transparent',
                  color: trackerFilter===f ? (f==='postule'?'#4ade80':f==='entretien'?'#f59e0b':f==='refus'?'#f87171':'#0ea5e9') : '#64748b',
                  borderColor: trackerFilter===f ? (f==='postule'?'rgba(74,222,128,0.4)':f==='entretien'?'rgba(245,158,11,0.4)':f==='refus'?'rgba(248,113,113,0.4)':'rgba(14,165,233,0.4)') : '#334155',
                }}>
                {f==='all'?'📋 Toutes':f==='postule'?'✅ Postulées':f==='entretien'?'🟡 Entretiens':'❌ Refus'}
                <span style={{marginLeft:'5px',fontSize:'11px',opacity:0.7}}>
                  {f==='all'?trackedList.length:trackedList.filter(([,s])=>s===f).length}
                </span>
              </button>
            ))}
          </div>

          {filteredTracker.length===0
            ? <div className="tracker-empty">
                <p style={{fontSize:'32px',marginBottom:'12px'}}>📋</p>
                <p>{trackerFilter==='all'?'Aucune candidature suivie.':'Aucune candidature dans cette catégorie.'}</p>
                {trackerFilter==='all' && <p style={{fontSize:'12px',color:'#334155',marginTop:'6px'}}>Clique sur ✅ Postulé sur une offre pour l'ajouter ici.</p>}
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {filteredTracker.map(([id,status])=>{
                  const job = trackedJobs[id]
                  if (!job) return null
                  return (
                    <div key={id} className="tracker-job">
                      <div className={`tracker-dot ${dotClass[status]}`}/>
                      <div className="tracker-info">
                        <div className="tracker-title">{job.title}</div>
                        <div className="tracker-meta">{job.company} · {job.location} · {job.country} · {job.contrat}</div>
                        <div style={{display:'flex',gap:'5px',marginTop:'6px'}}>
                          {(['postule','entretien','refus'] as Status[]).map(s=>(
                            <button key={s} onClick={()=>updateStatus(id,s)}
                              className={`status-btn${status===s?` active-${s}`:''}`}
                              style={{fontSize:'10px',padding:'2px 7px'}}>
                              {s==='postule'?'✅':s==='entretien'?'🟡':'❌'}
                            </button>
                          ))}
                        </div>
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
