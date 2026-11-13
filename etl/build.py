#!/usr/bin/env python3
"""Consolida data/raw/*.json (investigación con fuentes) en data/dashboard.json.

Uso:  python3 etl/build.py
No inventa ni interpola: solo selecciona, convierte unidades y suma. Si un dato
esperado no está en los archivos crudos, el script falla en vez de rellenar.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
H = json.loads((RAW / "hyperscalers.json").read_text())
C = json.loads((RAW / "chips.json").read_text())
S = json.loads((RAW / "startups.json").read_text())
N = json.loads((RAW / "negocios_macro.json").read_text())

hy = {c["id"]: c for c in H["companies"]}
ch = {c["id"]: c for c in C["companies"]}
st = {c["id"]: c for c in S["companies"]}
ng = {c["id"]: c for c in N["companies"]}
M = N["macro"]


def val(x):
    return x.get("value") if isinstance(x, dict) else x


def urls(node, n=2):
    """Primeras n URLs que aparezcan dentro de un nodo."""
    out = []

    def walk(x):
        if isinstance(x, str):
            if x.startswith("http") and " " not in x and x not in out:
                out.append(x)
        elif isinstance(x, dict):
            for k, v in x.items():
                if k in ("fx_source", "price_source"):
                    continue
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    walk(node)
    return out[:n]


def pick(lst, sub, key=None):
    """Único elemento cuya descripción contiene `sub`."""
    keys = [key] if key else ["claim", "metric", "counterparty", "name", "note", "summary", "period", "lab"]
    hits = [x for x in lst if any(sub.lower() in str(x.get(k, "")).lower() for k in keys)]
    if not hits:
        raise SystemExit(f"No encontrado en crudos: {sub!r}")
    return hits[0]


def r(x, d=2):
    return None if x is None else round(x, d)


# ───────────────────────── empresas cotizadas ─────────────────────────
SEG = {
    "gpu": "GPU / aceleradores", "custom_asic_networking": "chips a medida y redes", "foundry": "fundición",
    "memory": "memoria", "equipment": "equipos de litografía", "cpu_foundry": "CPU y fundición",
    "ip_licensing": "licencias de diseño", "servers": "servidores", "networking": "redes",
    "power_cooling": "energía y enfriamiento", "neocloud": "nube de GPU (neocloud)",
}
NAMES = {"alphabet": "Alphabet (Google)", "meta": "Meta", "alibaba": "Alibaba", "tencent": "Tencent",
         "micron": "Micron", "samsung": "Samsung Electronics", "marvell": "Marvell", "arm": "Arm",
         "dell": "Dell", "supermicro": "Super Micro", "arista": "Arista", "nebius": "Nebius", "cambricon": "Cambricon"}
companies = []


def latest(d, *prefer):
    for k in prefer:
        if isinstance(d.get(k), dict) and d[k].get("value") is not None:
            return d[k], k
    return {}, None


def add(c, cat, sub, scale=1.0, skip_fin=False, note=None):
    rev, rk = latest(c.get("revenue", {}), "TTM", "ttm", "FY2026", "2026")
    ni, _ = latest(c.get("net_income", {}), "TTM", "ttm", "FY2026", "2026")
    om, _ = latest(c.get("operating_margin_pct", {}), "TTM", "FY2026")
    gm, _ = latest(c.get("gross_margin_pct", {}), "TTM", "FY2026")
    mc = c.get("market_cap", {})
    sc = c.get("stock_change_pct") or {}
    mc0 = val(mc.get("2022-11-30"))
    mc1 = val(mc.get("latest"))
    since = sc.get("from_date") or "2022-11-30"
    companies.append({
        "id": c["id"], "name": NAMES.get(c["id"], c["name"]), "ticker": c.get("ticker"), "cat": cat, "sub": sub,
        "rev": None if skip_fin else r(val(rev) * scale if val(rev) is not None else None),
        "ni": None if skip_fin else r(val(ni) * scale if val(ni) is not None else None),
        "fin_period": rev.get("period") or rev.get("period_end") or rk,
        "op_margin": r(val(om), 1), "gross_margin": r(val(gm), 1),
        "mc0": r(mc0, 1), "mc1": r(mc1, 1), "mc_date": (mc.get("latest") or {}).get("date"),
        "chg": r(val(sc), 1), "since": since,
        "note": note,
        "src": (urls(rev, 1) + urls(mc.get("latest"), 1) + urls({k: v for k, v in sc.items() if k == "source"}, 1)),
    })


for cid in ["nvidia", "amd", "broadcom", "tsmc", "micron", "skhynix", "samsung", "asml", "intel", "marvell", "arm",
            "dell", "supermicro", "arista", "vertiv", "coreweave", "nebius", "smic", "cambricon"]:
    c = ch[cid]
    note = {
        "samsung": "Toda la empresa (teléfonos, TV, chips); casi toda la utilidad del 3T-2026 vino de memoria.",
        "skhynix": "Utilidad de 12 meses según agregador; el 3T-2026 incluyó una gran pérdida no operativa.",
        "arm": "Cambio desde su salida a bolsa (sep-2023).",
        "coreweave": "Cambio desde su salida a bolsa (mar-2025).",
        "nebius": "Cambio desde que volvió a cotizar (oct-2024).",
        "intel": "Utilidad de 12 meses aún negativa pese a un 3T-2026 con ganancia.",
    }.get(cid)
    add(c, "chips", SEG.get(c.get("segment"), c.get("segment")), note=note)

BIG_SUB = {"microsoft": "Azure, Copilot, socio de OpenAI", "alphabet": "Gemini, Google Cloud, chips TPU",
           "amazon": "AWS, Bedrock, socio de Anthropic", "meta": "Llama, Meta AI, anuncios con IA",
           "apple": "Apple Intelligence (caso control: casi sin capex de IA)", "oracle": "nube OCI para OpenAI y otros",
           "alibaba": "Qwen, Alibaba Cloud", "tencent": "Hunyuan, Yuanbao", "baidu": "Ernie, Baidu AI Cloud"}
BIG_NOTE = {
    "alphabet": "Utilidad inflada por ganancias contables en Anthropic y SpaceX (~US$ 98 mil M solo en el 2T-2026).",
    "amazon": "Utilidad inflada por la revalorización contable de su participación en Anthropic.",
    "microsoft": "Año fiscal a junio; 12 meses a sep-2026.",
    "oracle": "Año fiscal a mayo; 12 meses a ago-2026.",
    "alibaba": "Cifras en CNY convertidas a USD (estimado); último dato: jun-2026.",
    "tencent": "Cifras en CNY convertidas a USD (estimado); último dato: jun-2026.",
    "baidu": "Cifras en CNY convertidas a USD (estimado); último dato: jun-2026.",
}
for cid in ["microsoft", "alphabet", "amazon", "meta", "apple", "oracle", "alibaba", "tencent", "baidu"]:
    add(hy[cid], "big", BIG_SUB[cid], note=BIG_NOTE.get(cid))

SOFT_SUB = {"palantir": "plataforma AIP", "salesforce": "Agentforce", "servicenow": "Now Assist", "adobe": "Firefly",
            "sap": "Joule / Business AI", "ibm": "watsonx y consultoría", "snowflake": "datos y Cortex",
            "workday": "agentes de RR. HH.", "intuit": "asistentes financieros", "accenture": "consultoría de IA",
            "duolingo": "app con IA", "applovin": "publicidad con IA (Axon)", "shopify": "comercio con IA",
            "tesla": "conducción autónoma y robots"}
for cid, sub in SOFT_SUB.items():
    add(ng[cid], "soft", sub, scale=0.001, skip_fin=(cid == "sap"),
        note="Estados financieros en euros: no se incluye en los gráficos en dólares." if cid == "sap" else None)

# variación de capitalización en 2026 (software)
soft_ytd = []
for cid in SOFT_SUB:
    mc = ng[cid]["market_cap"]
    a, b = val(mc.get("2025-12-31")), val(mc.get("latest"))
    if a and b:
        soft_ytd.append({"id": cid, "name": NAMES.get(cid, ng[cid]["name"]), "pct": r((b / a - 1) * 100, 1),
                         "mc_2025": a, "mc_now": b, "src": urls(mc.get("latest"), 1)})

# ───────────────────────── capex y caja de los gigantes ─────────────────────────
CAPEX_IDS = ["amazon", "alphabet", "microsoft", "meta"]
capex = {"cats": ["2022", "2023", "2024", "2025", "2026 (guía)"], "series": [], "src": []}
for cid in CAPEX_IDS:
    cx = hy[cid]["capex"]
    g = cx["2026"]["guidance"]
    guide = g.get("value") if g.get("value") is not None else (g["low"] + g["high"]) / 2
    capex["series"].append({"id": cid, "name": NAMES.get(cid, hy[cid]["name"]),
                            "values": [r(val(cx[y]), 1) for y in ("2022", "2023", "2024", "2025")] + [guide]})
    capex["src"] += urls(cx["2025"], 1) + urls(g, 1)
capex["totals"] = [r(sum(s["values"][i] for s in capex["series"]), 0) for i in range(5)]

FISCAL_END = {"microsoft": "06", "oracle": "05"}
TTM_AT = {"microsoft": "2026-09", "oracle": "2026-08"}
fcf = {"series": [], "src": []}
for cid in ["microsoft", "alphabet", "amazon", "meta", "oracle"]:
    f = hy[cid]["fcf"]
    pts = []
    for y in ("2022", "2023", "2024", "2025", "2026"):
        if isinstance(f.get(y), dict) and val(f[y]) is not None:
            pts.append({"x": f"{y}-{FISCAL_END.get(cid, '12')}", "y": r(val(f[y]), 1),
                        "note": "año fiscal" if cid in FISCAL_END else None})
    pts.append({"x": TTM_AT.get(cid, "2026-09"), "y": r(val(f["ttm"]), 1), "note": "últimos 12 meses"})
    fcf["series"].append({"id": cid, "name": NAMES.get(cid, hy[cid]["name"]), "points": pts})
    fcf["src"] += urls(f["ttm"], 1)


def cloud(cid, sub):
    return pick(hy[cid]["cloud_ai"], sub, "metric")


def chipm(cid, sub, key="metric"):
    return pick(ch[cid]["ai_revenue"], sub, key)


backlog = []
for name, cat, node, extra in [
    ("Microsoft (nube comercial)", "big", cloud("microsoft", "remaining performance"), "+73 % en un año"),
    ("Oracle", "big", cloud("oracle", "Remaining performance"), "gran parte es el contrato con OpenAI"),
    ("Amazon AWS", "big", cloud("amazon", "backlog"), "más del doble en un año"),
    ("Google Cloud", "big", cloud("alphabet", "Cloud backlog"), ""),
    ("CoreWeave", "chips", chipm("coreweave", "backlog"), "US$ 55.6 mil M un año antes"),
    ("Dell (servidores de IA)", "chips", chipm("dell", "backlog"), "a jul-2026"),
    ("Nebius", "chips", chipm("nebius", "Remaining performance"), ""),
]:
    backlog.append({"name": name, "cat": cat, "value": val(node), "note": extra, "src": urls(node, 1)})

cloud_q = [
    {"name": "AWS", "rev": val(cloud("amazon", "AWS revenue")), "growth": 39, "op": val(cloud("amazon", "AWS operating income")),
     "src": urls(cloud("amazon", "AWS revenue"), 1)},
    {"name": "Azure", "rev": val(cloud("microsoft", "Azure revenue (first")), "growth": 48, "op": None,
     "src": urls(cloud("microsoft", "Azure revenue (first"), 1)},
    {"name": "Google Cloud", "rev": val(cloud("alphabet", "Google Cloud revenue")), "growth": 103,
     "op": val(cloud("alphabet", "Cloud operating income")), "src": urls(cloud("alphabet", "Google Cloud revenue"), 1)},
    {"name": "Oracle OCI", "rev": val(cloud("oracle", "Cloud infrastructure")), "growth": 121, "op": None,
     "src": urls(cloud("oracle", "Cloud infrastructure"), 1)},
]

# ───────────────────────── brecha capex vs ingresos ─────────────────────────
def macro(group, sub):
    return pick(M[group], sub, "claim")


def lab_rev(cid, date):
    return next(x for x in st[cid]["revenue"] if x["date"] == date)


g_capex = macro("hyperscaler_capex_by_year", "Combined 2026 capex guidance")
g_ev = macro("genai_revenue_by_year", "Exponential View 'State")
g_menlo = macro("genai_revenue_by_year", "3.2x YoY")
g_ant = lab_rev("anthropic", "2026-10-31")
g_oai = lab_rev("openai", "2026-09-30")
gap = [
    {"name": "Capex 2026 de Amazon, Alphabet, Microsoft y Meta", "sub": "guía oficial, punto medio", "value": capex["totals"][4], "hl": True, "src": capex["src"][:2] + urls(g_capex, 1)},
    {"name": "Ingresos de toda la IA generativa (sin China)", "sub": "ritmo anual a mediados de 2026, estimado de Exponential View", "value": val(g_ev), "src": urls(g_ev, 1)},
    {"name": "Anthropic", "sub": "ritmo anual a oct-2026 (bruto, según su prospecto)", "value": val(g_ant), "src": urls(g_ant, 1)},
    {"name": "OpenAI", "sub": "ritmo anual a sep-2026 (neto de socios de nube)", "value": val(g_oai), "src": urls(g_oai, 1)},
    {"name": "Gasto de empresas en IA generativa en 2025", "sub": "Menlo Ventures", "value": val(g_menlo), "src": urls(g_menlo, 1)},
]
cahn = []
for label, sub in [("2023", "$200B question"), ("2024", "$600B question"), ("2025", "$840B question"), ("2026", "$1.5T question")]:
    n = macro("revenue_gap_estimates", sub)
    cahn.append({"year": label, "value": 1500 if label == "2026" else val(n), "src": urls(n, 1)})
bain = {"need_2031": val(macro("revenue_gap_estimates", "needed by 2031")),
        "missing_2031": val(macro("revenue_gap_estimates", "still to be created")),
        "src": urls(macro("revenue_gap_estimates", "needed by 2031"), 1)}

# ───────────────────────── chips ─────────────────────────
nvda_dc = {"cats": [], "values": [], "src": []}
for fy, lab in [("FY2023", "AF 2023"), ("FY2024", "AF 2024"), ("FY2025", "AF 2025"), ("FY2026", "AF 2026")]:
    n = next(x for x in ch["nvidia"]["ai_revenue"] if x["metric"] == "Data Center revenue" and x["period"].startswith(fy))
    nvda_dc["cats"].append(lab)
    nvda_dc["values"].append(val(n))
    nvda_dc["src"] += urls(n, 1)
nv_q = chipm("nvidia", "Q2 FY2027", "period")
nvda_dc["latest_q"] = {"value": val(nv_q), "src": urls(nv_q, 1)}
nv_conc = next(x for x in ch["nvidia"]["notes"] if "Customer concentration" in x)
nv_port = pick(ch["nvidia"]["deals"], "Portfolio total", "counterparty")

# ───────────────────────── laboratorios y startups ─────────────────────────
TALKS = {"openai": {"2026-09-15", "2026-09-29"}, "anthropic": {"2026-11-10"}}


def norm(d):
    d = str(d)
    return d + "-12" if len(d) == 4 else d


valuations = {"series": [], "src": []}
for cid, name in [("anthropic", "Anthropic"), ("openai", "OpenAI"), ("xai", "xAI")]:
    pts = [{"x": norm(v["date"]), "y": v["value"], "note": None} for v in st[cid]["valuations"]
           if v["date"] not in TALKS.get(cid, set()) and v.get("value")]
    valuations["series"].append({"id": cid, "name": name, "points": pts})
    valuations["src"] += urls(st[cid]["valuations"][-3:], 2)

runrate = {"series": [], "src": []}
for cid, name, skip in [("anthropic", "Anthropic (bruto)", set()), ("openai", "OpenAI (neto)", {"2026-09-29"})]:
    pts = [{"x": norm(v["date"]), "y": v["value"], "note": "estimado" if v.get("status") == "estimate" else None}
           for v in st[cid]["revenue"] if v.get("kind") == "run_rate" and v["date"] not in skip and v.get("value")]
    runrate["series"].append({"id": cid, "name": name, "points": pts})
    runrate["src"] += urls([v for v in st[cid]["revenue"] if v.get("kind") == "run_rate"][-2:], 2)


def loss(cid, period, metric):
    return next(x for x in st[cid]["losses"] if x["period"] == period and x["metric"] == metric)


def commit(cid, sub):
    return pick(st[cid]["compute_commitments"], sub, "counterparty")


oai_c, ant_c = commit("openai", "UPDATED"), commit("anthropic", "TOTAL")
lab_money = [
    {"name": "Anthropic: compromisos de cómputo", "sub": "compras y arriendos hasta 2045, según prospecto", "value": val(ant_c), "kind": "commit", "src": urls(ant_c, 1)},
    {"name": "OpenAI: gasto de nube planeado", "sub": "hasta 2030 (prensa, sep-2026)", "value": val(oai_c), "kind": "commit", "src": urls(oai_c, 1)},
    {"name": "Anthropic: ingresos", "sub": "ritmo anual a oct-2026 (bruto)", "value": val(g_ant), "kind": "rev", "src": urls(g_ant, 1)},
    {"name": "OpenAI: ingresos", "sub": "ritmo anual a sep-2026 (neto)", "value": val(g_oai), "kind": "rev", "src": urls(g_oai, 1)},
]
oai25, oai_op, oai_burn = lab_rev("openai", "2025"), loss("openai", "2025", "operating_loss"), loss("openai", "2026 (projected)", "cash_burn_projection")
oai_fcf = loss("openai", "2026-2030 (projected)", "cumulative_negative_fcf_projection")
ant9, ant_op = lab_rev("anthropic", "2026-9M"), loss("anthropic", "2026-9M", "operating_loss")
ant_cash = loss("anthropic", "2026-9M", "operating_cash_outflow")
lab_pnl = {
    "openai": {"rev_2025": val(oai25), "op_loss_2025": val(oai_op), "burn_2026": val(oai_burn), "neg_fcf_2026_2030": val(oai_fcf),
               "src": urls(oai25, 1) + urls(oai_op, 1) + urls(oai_fcf, 1)},
    "anthropic": {"rev_9m_2026": val(ant9), "op_loss_9m_2026": val(ant_op), "op_cash_9m_2026": -val(ant_cash),
                  "src": urls(ant9, 1) + urls(ant_op, 1)},
}

REV_OVERRIDE = {"perplexity": "2026-04", "cursor": "2026-02"}
VAL_SKIP = {"perplexity": {"2026-08-23"}, "cursor": {"2026-04"}, "thinking-machines": {"2026-11"}, "moonshot": {"2026-10"}}
MULT = [("anthropic", "Anthropic"), ("openai", "OpenAI"), ("databricks", "Databricks"), ("cursor", "Cursor"),
        ("cognition", "Cognition (Devin)"), ("mistral", "Mistral"), ("perplexity", "Perplexity"), ("elevenlabs", "ElevenLabs"),
        ("sierra", "Sierra"), ("harvey", "Harvey"), ("lovable", "Lovable"), ("replit", "Replit"), ("glean", "Glean")]
multiples = []
for cid, name in MULT:
    c = st[cid]
    v = [x for x in c["valuations"] if x.get("value") and x["date"] not in VAL_SKIP.get(cid, TALKS.get(cid, set()))][-1]
    revs = [x for x in c["revenue"] if x.get("kind") == "run_rate" and x.get("value") and "(" not in x["date"] and x["date"] != "2026-09-29"]
    if cid in REV_OVERRIDE:
        rv = next(x for x in revs if x["date"] == REV_OVERRIDE[cid])
    else:
        rv = sorted(revs, key=lambda x: norm(x["date"]))[-1]
    multiples.append({"name": name, "cat": "labs", "mult": r(v["value"] / rv["value"], 1), "val": v["value"], "val_date": v["date"],
                      "rev": rv["value"], "rev_date": rv["date"], "src": urls(v, 1) + urls(rv, 1)})
for cid in ["nvidia", "microsoft", "palantir", "alphabet"]:
    co = next(x for x in companies if x["id"] == cid)
    multiples.append({"name": co["name"], "cat": co["cat"], "mult": r(co["mc1"] / co["rev"], 1), "val": co["mc1"], "val_date": "2026-11-12",
                      "rev": co["rev"], "rev_date": "12 meses", "src": co["src"][:2]})

labs_table = []
for cid, name, what in [
    ("anthropic", "Anthropic", "Claude"), ("openai", "OpenAI", "ChatGPT, GPT"), ("xai", "xAI (hoy dentro de SpaceX)", "Grok"),
    ("databricks", "Databricks", "plataforma de datos e IA"), ("cursor", "Cursor (comprada por SpaceX)", "editor de código con IA"),
    ("cognition", "Cognition", "agente programador Devin"), ("prometheus", "Project Prometheus", "IA física"),
    ("figure", "Figure AI", "robots humanoides"), ("moonshot", "Moonshot (Kimi)", "modelos, China"), ("ssi", "Safe Superintelligence", "sin producto"),
    ("cohere", "Cohere", "modelos para empresas"), ("mistral", "Mistral AI", "modelos, Francia"), ("perplexity", "Perplexity", "buscador con IA"),
    ("elevenlabs", "ElevenLabs", "voz sintética"), ("sierra", "Sierra", "agentes de atención"), ("harvey", "Harvey", "IA legal"),
    ("lovable", "Lovable", "crear apps con IA"), ("thinking-machines", "Thinking Machines Lab", "sin producto público"),
    ("replit", "Replit", "programación con IA"), ("glean", "Glean", "búsqueda empresarial"), ("runway", "Runway", "video generativo"),
]:
    c = st[cid]
    vs = [x for x in c["valuations"] if x.get("value") and x["date"] not in VAL_SKIP.get(cid, TALKS.get(cid, set()))]
    v = vs[-1] if vs else None
    revs = [x for x in c["revenue"] if x.get("kind") == "run_rate" and x.get("value") and "(" not in x["date"] and x["date"] != "2026-09-29"]
    rv = None
    if revs:
        rv = next(x for x in revs if x["date"] == REV_OVERRIDE[cid]) if cid in REV_OVERRIDE else sorted(revs, key=lambda x: norm(x["date"]))[-1]
    labs_table.append({"name": name, "what": what, "val": v["value"] if v else None, "val_date": v["date"] if v else None,
                       "val_est": bool(v and v.get("status") == "estimate"),
                       "rev": rv["value"] if rv else None, "rev_date": rv["date"] if rv else None,
                       "src": (urls(v, 1) if v else []) + (urls(rv, 1) if rv else [])})
labs_table.sort(key=lambda x: -(x["val"] or 0))


def fail(name, year):
    return next(x for x in S["failures"] if x["name"].startswith(name) and x["year"] == year)


failures = [
    {"name": "Inflection AI", "year": 2024, "what": "Microsoft pagó unos US$ 650 M por una licencia y se llevó al CEO y a casi todo el equipo; quedó un cascarón.", "src": urls(fail("Inflection", 2024), 1)},
    {"name": "Character.AI", "year": 2026, "what": "Tras licenciar su tecnología a Google por ~US$ 2.7 mil M (2024), se acogió a la ley de quiebras en octubre de 2026 en medio de demandas.", "src": urls(fail("Character.AI", 2026), 1)},
    {"name": "Windsurf", "year": 2025, "what": "Se cayó su compra por OpenAI (~US$ 3 mil M); Google pagó US$ 2.4 mil M por licencia y fichajes, y Cognition compró el resto.", "src": urls(fail("Windsurf", 2025), 1)},
    {"name": "Humane", "year": 2025, "what": "Descontinuó su AI Pin; HP compró los restos por US$ 116 M, menos de la mitad del capital levantado.", "src": urls(fail("Humane", 2025), 1)},
    {"name": "Builder.ai", "year": 2025, "what": "Valorada en más de US$ 1 mil M, entró en insolvencia tras descubrirse ingresos sobrestimados.", "src": urls(fail("Builder.ai", 2025), 1)},
    {"name": "xAI", "year": 2026, "what": "Quemaba ~US$ 1 mil M al mes; fue absorbida por SpaceX en una operación que analistas llamaron «rescate instantáneo».", "src": urls(fail("xAI", 2026), 1)},
    {"name": "Aleph Alpha", "year": 2026, "what": "El aspirante a campeón alemán de IA aceptó ser absorbido por Cohere (~10 % de la empresa combinada).", "src": urls(fail("Aleph Alpha", 2026), 1)},
    {"name": "Sora (app de OpenAI)", "year": 2026, "what": "OpenAI cerró su app de video para consumidores por el costo de cómputo y la baja retención.", "src": urls(fail("Sora", 2026), 1)},
]

# ───────────────────────── software: métricas de IA divulgadas ─────────────────────────
def aim(cid, sub):
    return pick(ng[cid]["ai_metrics"], sub, "metric")


ai_metrics = [
    {"co": "Palantir", "metric": "Ingresos comerciales en EE. UU., 3T-2026", "value": "US$ 984 M (+148 %)", "src": urls(aim("palantir", "US commercial revenue (up"), 1)},
    {"co": "Salesforce", "metric": "Ingreso anual recurrente de Agentforce, jul-2026", "value": "> US$ 1.5 mil M", "src": urls(aim("salesforce", "Agentforce ARR"), 1)},
    {"co": "ServiceNow", "metric": "Meta de contratos anuales de IA para fin de 2026", "value": "> US$ 1.7 mil M", "src": urls(aim("servicenow", "AI ACV target"), 1)},
    {"co": "IBM", "metric": "Cartera de IA generativa acumulada (último dato, 4T-2025)", "value": "> US$ 12.5 mil M; dejó de publicarla", "src": urls(aim("ibm", "(>$12.5B"), 1)},
    {"co": "Accenture", "metric": "Ingresos de IA avanzada, año fiscal 2025", "value": "US$ 2.7 mil M; dejó de publicarlos", "src": urls(aim("accenture", "Advanced AI revenue, full"), 1)},
    {"co": "Workday", "metric": "Parte de los contratos nuevos impulsada por IA", "value": "> 25 %", "src": urls(aim("workday", "Share of new ACV"), 1)},
    {"co": "Adobe, SAP, Intuit, Snowflake", "metric": "Ingresos de IA en dólares", "value": "no los publican", "src": []},
]

# ───────────────────────── dinero circular ─────────────────────────
def deal(cid, sub):
    return pick(ch[cid]["deals"], sub, "counterparty")


def stake(cid, lab):
    return pick(hy[cid]["lab_stakes"], lab, "lab")


flows = [
    {"a": "Nvidia", "b": "OpenAI", "amt": "US$ 30 mil M", "kind": "inversión",
     "what": "La carta de intención de 2025 por «hasta US$ 100 mil M» nunca se firmó; quedó en una inversión de US$ 30 mil M en la ronda de 2026. OpenAI gasta en chips de Nvidia.", "src": urls(deal("nvidia", "OpenAI"), 2)},
    {"a": "OpenAI", "b": "Oracle", "amt": "≈ US$ 300 mil M", "kind": "contrato de nube, ~5 años",
     "what": "Sostiene buena parte de la cartera de pedidos de Oracle, que a su vez se endeuda para construir.", "src": urls(commit("openai", "Oracle"), 1)},
    {"a": "OpenAI", "b": "Microsoft Azure", "amt": "US$ 250 mil M", "kind": "contrato de nube",
     "what": "Microsoft posee cerca de una cuarta parte de OpenAI y le vende el cómputo.", "src": urls(commit("openai", "Microsoft"), 1) + urls(stake("microsoft", "OpenAI"), 1)},
    {"a": "Amazon", "b": "Anthropic", "amt": "US$ 13 mil M", "kind": "inversión (hasta ~33 mil M)",
     "what": "Anthropic se comprometió a gastar al menos US$ 110 mil M en AWS hasta 2036. Amazon anotó US$ 53.4 mil M de ganancia contable por esa participación solo en el 2T-2026.", "src": urls(stake("amazon", "Anthropic"), 1) + urls(commit("anthropic", "Amazon"), 1)},
    {"a": "Google", "b": "Anthropic", "amt": "hasta US$ 40 mil M", "kind": "inversión, abr-2026",
     "what": "Anthropic le debe a Google unos US$ 121 mil M en cómputo hasta 2033.", "src": urls(stake("alphabet", "Anthropic"), 1) + urls(commit("anthropic", "Google"), 1)},
    {"a": "Microsoft y Nvidia", "b": "Anthropic", "amt": "hasta US$ 15 mil M", "kind": "inversión, nov-2025",
     "what": "A cambio, Anthropic comprometió US$ 30 mil M de Azure sobre sistemas de Nvidia.", "src": urls(deal("nvidia", "Anthropic"), 1)},
    {"a": "AMD", "b": "OpenAI", "amt": "160 M de acciones", "kind": "opciones (warrants)",
     "what": "AMD le entrega opciones sobre ~10 % de la empresa a medida que OpenAI despliega hasta 6 GW de sus chips.", "src": urls(deal("amd", "OpenAI"), 1)},
    {"a": "Nvidia", "b": "CoreWeave", "amt": "US$ 2 mil M", "kind": "inversión, ene-2026",
     "what": "CoreWeave compra GPU de Nvidia con deuda y las alquila, entre otros, a OpenAI.", "src": urls(deal("nvidia", "CoreWeave"), 1)},
]
paper_gains = [
    {"name": "Alphabet · 2T-2026", "sub": "Anthropic y SpaceX", "value": 98, "src": urls(stake("alphabet", "Anthropic")["gains_losses"][2], 1)},
    {"name": "Amazon · 2T-2026", "sub": "Anthropic", "value": 53.4, "src": urls(stake("amazon", "Anthropic")["gains_losses"][2], 1)},
    {"name": "Alphabet · 1T-2026", "sub": "valores de renta variable", "value": 36.9, "src": urls(stake("alphabet", "Anthropic")["gains_losses"][1], 1)},
    {"name": "Amazon · 1T-2026", "sub": "Anthropic", "value": 16.8, "src": urls(stake("amazon", "Anthropic")["gains_losses"][1], 1)},
    {"name": "Microsoft · año fiscal 2026", "sub": "OpenAI", "value": 6.5, "src": urls(stake("microsoft", "OpenAI")["gains_losses"][2], 1) or urls(stake("microsoft", "OpenAI"), 1)},
]

# ───────────────────────── riesgos ─────────────────────────
b25 = macro("bubble_indicators", "full-year 2025")
b26 = macro("bubble_indicators", "first five months of 2026")
amz_debt = hy["amazon"]["debt_notes"][0]
roi = []
for label, sub, grp, fmt in [
    ("de las organizaciones no obtuvo retorno medible de sus pilotos de IA generativa (MIT NANDA, 2025)", "MIT NANDA", "enterprise_roi_studies", "{} %"),
    ("de las empresas atribuye a la IA al menos 5 % de su utilidad operativa; igual que en 2025 (McKinsey, 2026)", "AI high performers", "enterprise_roi_studies", "{} %"),
    ("reporta algún impacto de la IA en su utilidad operativa (McKinsey, 2026)", "at least some EBIT impact", "enterprise_roi_studies", "{} %"),
    ("de las empresas de EE. UU. usó IA en las últimas dos semanas (Oficina del Censo, may-2026)", "US Census Bureau BTOS: share", "enterprise_roi_studies", "{} %"),
]:
    n = macro(grp, sub)
    roi.append({"value": fmt.format(val(n)), "label": label, "src": urls(n, 1)})

EVENTS = [
    ("abr 2026", "«SaaSpocalipsis»: el índice de software IGV cae más de 27 % en el año; su peor trimestre desde 2008.", "bubble_indicators", "SaaSpocalypse"),
    ("jul 2026", "Resultados del 2T: Microsoft sube 15 % en un día; Alphabet cae tras su primer flujo de caja libre negativo.", "h2_2026_events", "Q2 2026 earnings"),
    ("ago 2026", "Intuit recorta su guía y despide al 17 % de su plantilla.", "h2_2026_events", "Intuit 'strategic reset'"),
    ("oct 2026", "El FMI y el Banco de Inglaterra advierten de una corrección brusca ligada a la IA.", "h2_2026_events", "IMF GFSR and Bank of England"),
    ("26 oct 2026", "Anthropic presenta su prospecto para salir a bolsa en Nasdaq.", "h2_2026_events", "Anthropic publicly files"),
    ("29 oct 2026", "Alphabet cae 12.6 % en un día, su peor jornada desde 2004, pese al crecimiento de su nube.", "h2_2026_events", "Alphabet shares fall"),
    ("3 nov 2026", "Elecciones en EE. UU.: 38 de 41 consultas locales aprueban frenos a los centros de datos.", "h2_2026_events", "US midterm elections"),
    ("5 nov 2026", "Desplome de la IA: S&P 500 −4.4 %, Nasdaq −5.5 %, Nvidia −9.3 %, AMD −17.3 %.", "h2_2026_events", "Nasdaq Composite -5.5%"),
    ("9 nov 2026", "Rebote parcial: Nasdaq +2.7 %, S&P 500 +2.4 %.", "h2_2026_events", "Partial rebound"),
]
events = [{"date": d, "what": w, "src": urls(macro(g, s), 1)} for d, w, g, s in EVENTS]

iea25, iea30 = macro("energy", "global data-centre electricity consumption"), macro("energy", "roughly doubles by 2030")
ms27 = macro("capex_forecasts", "reaffirmed unchanged")
gs27 = macro("capex_forecasts", "Goldman Sachs: hyperscaler")
risks = {
    "bonds_2025": {"value": val(b25), "src": urls(b25, 1)},
    "bonds_2026_5m": {"value": val(b26), "src": urls(b26, 1)},
    "amazon_debt": {"from": 65.6, "to": 173.1, "src": urls(amz_debt, 1)},
    "coreweave_debt": {"value": val(chipm("coreweave", "Total debt")), "src": urls(chipm("coreweave", "Total debt"), 1)},
    "iea": {"y2025": val(iea25), "y2030": val(iea30), "src": urls(iea25, 1)},
    "forecast_2027": {"goldman": val(gs27), "morgan": val(ms27), "src": urls(gs27, 1) + urls(ms27, 1)},
}

# ───────────────────────── ganancias y pérdidas en un solo gráfico ─────────────────────────
xai_op = loss("xai", "2025", "operating_loss")
pnl_top = [{"name": c["name"], "cat": c["cat"], "value": c["ni"], "sub": "utilidad neta, 12 meses", "note": c.get("note"), "src": c["src"][:1]}
           for c in companies if c["ni"] is not None]
pnl_top.sort(key=lambda x: -x["value"])
pnl_top = pnl_top[:15] + [x for x in pnl_top[15:] if x["value"] < 0]
pnl_top += [
    {"name": "Anthropic", "cat": "labs", "value": -val(ant_op), "sub": "resultado operativo, 9 meses de 2026", "note": "Según resúmenes de su prospecto; la pérdida neta contable es mucho mayor por ajustes sin salida de caja.", "src": urls(ant_op, 1)},
    {"name": "xAI", "cat": "labs", "value": -val(xai_op), "sub": "resultado operativo, 2025", "note": "Según el prospecto de SpaceX, que la absorbió en 2026.", "src": urls(xai_op, 1)},
    {"name": "OpenAI", "cat": "labs", "value": -val(oai_op), "sub": "resultado operativo, 2025", "note": "Cifras filtradas a la prensa, no auditadas públicamente.", "src": urls(oai_op, 1)},
]
pnl_top.sort(key=lambda x: -x["value"])

# ───────────────────────── ficha de rentabilidad y documentos primarios ─────────────────────────
RP, DP = RAW / "rentabilidad.json", RAW / "documentos.json"
rent = {c["id"]: c for c in json.loads(RP.read_text())["companies"]} if RP.exists() else {}
docs_raw = json.loads(DP.read_text()) if DP.exists() else {"companies": [], "studies": []}
dco = {c["id"]: c for c in docs_raw.get("companies", [])}


def ratio(a, b):
    return None if a is None or not b else round(a / b * 100, 1)


def link(x):
    if not isinstance(x, dict) or not x.get("url"):
        return None
    return {"url": x["url"], "title": x.get("title"), "pdf": bool(x.get("is_pdf")), "ok": bool(x.get("verified"))}


for c in companies:
    rr = rent.get(c["id"]) or {}
    t, y = rr.get("ttm") or {}, rr.get("fy2022") or {}
    if t.get("revenue"):
        usd = rr.get("currency") == "USD"
        u = str(rr.get("unit", "millions")).lower()
        unit = 1.0 if "billion" in u else 1e-6 if "thousand" in u else 1e-3
        k = unit if usd else (c["rev"] / t["revenue"] if c["rev"] else None)

        def conv(v, k=k):
            return None if v is None or k is None else round(v * k, 2)

        cap = t.get("capex")
        cap = abs(cap) if cap is not None else None
        c["f"] = {
            "rev": conv(t.get("revenue")), "gp": conv(t.get("gross_profit")), "oi": conv(t.get("operating_income")),
            "ni": conv(t.get("net_income")), "rd": conv(t.get("rd")), "capex": conv(cap), "fcf": conv(t.get("fcf")),
            "gm": ratio(t.get("gross_profit"), t["revenue"]), "om": ratio(t.get("operating_income"), t["revenue"]),
            "nm": ratio(t.get("net_income"), t["revenue"]), "capex_pct": ratio(cap, t["revenue"]),
            "gm22": ratio(y.get("gross_profit"), y.get("revenue")), "om22": ratio(y.get("operating_income"), y.get("revenue")),
            "nm22": ratio(y.get("net_income"), y.get("revenue")),
            "period": t.get("period_end"), "fx": not usd, "currency": rr.get("currency"),
        }
    d = dco.get(c["id"]) or {}
    c["links"] = {"fin": rr.get("source_income"), "cash": rr.get("source_cashflow"), "ir": link(d.get("ir")),
                  "annual": link(d.get("annual")), "quarterly": link(d.get("quarterly"))}
studies = [{"org": x.get("org"), "title": x.get("title"), "date": x.get("date"), "url": x["url"], "pdf": bool(x.get("is_pdf")),
            "ok": bool(x.get("verified"))} for x in docs_raw.get("studies", []) if x.get("url")]

out = {
    "as_of": "2026-11-13",
    "companies": companies, "soft_ytd": soft_ytd,
    "capex": capex, "fcf": fcf, "backlog": backlog, "cloud_q": cloud_q,
    "gap": gap, "cahn": cahn, "bain": bain,
    "nvda_dc": nvda_dc, "nvda_conc_src": [u for u in nv_conc.split() if u.startswith("http")][:1], "nvda_portfolio_src": urls(nv_port, 1),
    "valuations": valuations, "runrate": runrate, "lab_money": lab_money, "lab_pnl": lab_pnl,
    "multiples": multiples, "labs_table": labs_table, "failures": failures,
    "ai_metrics": ai_metrics, "flows": flows, "paper_gains": paper_gains,
    "pnl_top": pnl_top, "roi": roi, "events": events, "risks": risks, "studies": studies,
}
(ROOT / "data" / "dashboard.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
allu = set()


def collect(x):
    if isinstance(x, dict):
        for k, v in x.items():
            if k == "src" or k.endswith("_src"):
                allu.update(v)
            else:
                collect(v)
    elif isinstance(x, list):
        for v in x:
            collect(v)


collect(out)
for c in companies:
    for v in c["links"].values():
        if isinstance(v, str):
            allu.add(v)
        elif isinstance(v, dict):
            allu.add(v["url"])
allu.update(x["url"] for x in studies)
(ROOT / "data" / "fuentes.txt").write_text("\n".join(sorted(allu)) + "\n")
print(f"OK: {len(companies)} empresas cotizadas, {len(labs_table)} labs/startups, {len(allu)} fuentes distintas")
