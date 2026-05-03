import { NextRequest, NextResponse } from 'next/server'

const COUNTRY_CODES: Record<string, string> = {
  fr: 'fr', gb: 'gb', de: 'de', be: 'be', nl: 'nl',
  es: 'es', it: 'it', ch: 'ch', at: 'at', pl: 'pl',
  lu: 'lu', pt: 'pt',
}

async function fetchAdzuna(what: string, page: string, perPage: string, country: string, contratFilter: string) {
  const APP_ID  = process.env.ADZUNA_APP_ID
  const APP_KEY = process.env.ADZUNA_APP_KEY
  if (!APP_ID || !APP_KEY) return { jobs: [], total: 0 }

  const cc = COUNTRY_CODES[country] || 'fr'
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${cc}/search/${page}`)
  url.searchParams.set('app_id', APP_ID)
  url.searchParams.set('app_key', APP_KEY)
  url.searchParams.set('what', what)
  url.searchParams.set('results_per_page', perPage)
  url.searchParams.set('content-type', 'application/json')
  if (contratFilter === 'CDI') url.searchParams.set('contract_type', 'permanent')
  if (contratFilter === 'Stage') url.searchParams.set('contract_type', 'contract')

  const res = await fetch(url.toString())
  if (!res.ok) return { jobs: [], total: 0 }
  const data = await res.json()

  const jobs = (data.results || []).map((j: any) => {
    let contrat = 'CDI'
    if (j.contract_type === 'contract') contrat = 'Stage'
    if (j.title && /alternance|apprentissage|alternant/i.test(j.title)) contrat = 'Alternance'
    if (j.description && /alternance|apprentissage/i.test(j.description)) contrat = 'Alternance'

    return {
      id:       String(j.id),
      title:    String(j.title || '—'),
      company:  String(j.company?.display_name || '—'),
      location: String((j.location?.area)?.[2] || j.location?.display_name || '—'),
      country:  cc.toUpperCase(),
      contrat,
      age:      Math.floor((Date.now() - new Date(j.created).getTime()) / 86400000),
      desc:     String(j.description || ''),
      tags:     [] as string[],
      url:      String(j.redirect_url || '#'),
      source:   'Adzuna',
    }
  })

  return { jobs, total: Number(data.count) || 0 }
}

async function fetchGoogleJobs(what: string, country: string) {
  const SERP_KEY = process.env.SERP_API_KEY
  if (!SERP_KEY) return []

  const countryNames: Record<string,string> = {
    fr:'France', gb:'United Kingdom', de:'Allemagne', be:'Belgique',
    nl:'Pays-Bas', es:'Espagne', it:'Italie', ch:'Suisse', at:'Autriche'
  }
  const countryName = countryNames[country] || 'France'

  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('engine', 'google_jobs')
  url.searchParams.set('q', `${what} ${countryName}`)
  url.searchParams.set('hl', 'fr')
  url.searchParams.set('gl', country === 'gb' ? 'gb' : 'fr')
  url.searchParams.set('api_key', SERP_KEY)
  url.searchParams.set('chips', 'date_posted:month')

  const res = await fetch(url.toString())
  if (!res.ok) return []
  const data = await res.json()

  return (data.jobs_results || []).map((j: any, i: number) => {
    const dateStr = String(j.detected_extensions?.posted_at || '')
    let age = 7
    if (dateStr.includes('hour') || dateStr.includes('heure')) age = 0
    else if (dateStr.includes('day') || dateStr.includes('jour')) age = parseInt(dateStr) || 1
    else if (dateStr.includes('week') || dateStr.includes('semaine')) age = (parseInt(dateStr) || 1) * 7
    else if (dateStr.includes('month') || dateStr.includes('mois')) age = 30

    let contrat = 'CDI'
    const txt = `${j.title} ${j.description || ''}`
    if (/alternance|apprentissage|alternant/i.test(txt)) contrat = 'Alternance'
    else if (/stage|internship|intern\b/i.test(txt)) contrat = 'Stage'

    return {
      id:       `serp_${i}_${Date.now()}`,
      title:    String(j.title || '—'),
      company:  String(j.company_name || '—'),
      location: String(j.location || countryName),
      country:  country.toUpperCase(),
      contrat,
      age,
      desc:     String(j.description || ''),
      tags:     [] as string[],
      url:      String(j.related_links?.[0]?.link || j.share_link || '#'),
      source:   String(j.via ? j.via.replace('via ', '') : 'Google Jobs'),
    }
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const what    = searchParams.get('what')    || 'data'
  const page    = searchParams.get('page')    || '1'
  const perPage = searchParams.get('per_page')|| '20'
  const country = searchParams.get('country') || 'fr'
  const contrat = searchParams.get('contrat') || ''

  const [adzunaResult, googleResult] = await Promise.allSettled([
    fetchAdzuna(what, page, perPage, country, contrat),
    page === '1' ? fetchGoogleJobs(what, country) : Promise.resolve([]),
  ])

  const adzunaJobs  = adzunaResult.status === 'fulfilled' ? adzunaResult.value.jobs  : []
  const adzunaTotal = adzunaResult.status === 'fulfilled' ? adzunaResult.value.total : 0
  const googleJobs  = googleResult.status === 'fulfilled' ? googleResult.value       : []

  const seen   = new Set<string>()
  const unique = [...adzunaJobs, ...googleJobs].filter(j => {
    const key = `${j.title.toLowerCase()}|${j.company.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ results: unique, count: adzunaTotal })
}
