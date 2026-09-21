/*
MOCKUP — Resultados (Financeiro Viofilme) · FONTE LEGÍVEL · ARQUIVO 3 de 3
Lógica do mockup: estado, DADOS DE EXEMPLO (fictícios, mas coerentes entre si; use como exemplo de cálculo),
derivações e handlers. Os bindings {{ ... }} de mockup_resultados_1_pagina.html e mockup_resultados_2_paineis.html vêm daqui
(principalmente de renderVals()). DCLogic é a classe base do runtime do Claude Design (setState, props).
Props do componente: {"accent":{"editor":"color","default":"#A99BFF","options":["#A99BFF","#F2A97E","#9ADFB5","#E8D27A"]},"$preview":{"width":1440,"height":1500}}
*/
class Component extends DCLogic {
  constructor(...a) {
    super(...a);
    this.state = { tab: 'dre', gran: 'mes', mes: 8, comp: 'ant', modo: 'periodo', open: { rb: false, cd: true, dop: false, fin: false, ded: false }, lanc: null, seloOpen: false, dim: 'cli', como: false, cli: null, hovCli: null, simFee: '', evoModo: 'tipo', toast: null };
  }
  money0(n) { return (n < 0 ? '−R$ ' : 'R$ ') + Math.abs(Math.round(n)).toLocaleString('pt-BR'); }
  num0(n) { const r = Math.round(n); return r === 0 ? '—' : (r < 0 ? '−' : '') + Math.abs(r).toLocaleString('pt-BR'); }
  mil(n) { return (n < 0 ? '−' : '') + 'R$ ' + (Math.abs(n) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'; }
  pct(n, d) { return d ? (n / d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—'; }
  parse(s) { const v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(v) ? 0 : v; }
  say(m) { this.setState({ toast: m }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 3600); }
  componentWillUnmount() { clearTimeout(this._t); }
  data() {
    if (this._d) return this._d;
    const C = (nome, sq, servs, fee, vagas, x) => Object.assign({ nome, sq, servs, fee, vagas, pont: {}, vp: {}, dir: {} }, x || {});
    const SMTR = (a) => [['Social Media', a], ['Tráfego pago', 1 - a]];
    const f3 = (v) => ({ 7: v, 8: v, 9: v });
    const clients = [
      C('Grupo Litoral Shopping', 'A', [['Social Media', 0.5], ['Tráfego pago', 0.3], ['Audiovisual', 0.2]], f3(9500), { SM: 2, TR: 1, DS: 1, AV: 1, CS: 1 }),
      C('Rede Farma Mais', 'A', SMTR(0.4), f3(8200), { SM: 1, TR: 2, DS: 1, CS: 1 }),
      C('Restaurante Sabor do Mar', 'A', [['Social Media', 0.55], ['Audiovisual', 0.45]], f3(7800), { SM: 1, DS: 1, AV: 3, CS: 1 }, { pont: { 9: [8600, 'Campanha de verão', 'Audiovisual'] }, vp: { 9: { AV: 1 } }, dir: { 7: [['freelas', 1300, 'Marina Costa, edição']], 8: [['freelas', 1500, 'Marina Costa, edição']], 9: [['freelas', 1200, 'Marina Costa, edição'], ['audio', 900, 'Estúdio Som Norte, trilha']] } }),
      C('Colégio Horizonte Azul', 'B', [['Social Media', 0.5], ['Tráfego pago', 0.35], ['Audiovisual', 0.15]], f3(6400), { SM: 1, TR: 1, DS: 1, AV: 0.5, CS: 1 }, { pont: { 7: [9500, 'Vídeo de matrícula', 'Audiovisual'] }, vp: { 7: { AV: 2 } }, dir: { 7: [['freelas', 2200, 'Freelancers de captação'], ['locacao', 900, 'LocaCine, iluminação']] } }),
      C('Imobiliária Costa Norte', 'A', SMTR(0.6), f3(6200), { SM: 1, TR: 1, DS: 1, AV: 1, CS: 1 }),
      C('Vila Serrana Hotel', 'B', [['Social Media', 0.5], ['Tráfego pago', 0.3], ['Audiovisual', 0.2]], f3(5800), { SM: 1, TR: 1, DS: 1, AV: 1, CS: 1 }, { pont: { 7: [8000, 'Ensaio fotográfico', 'Audiovisual'] }, dir: { 7: [['freelas', 1100, 'Fotógrafo assistente']] } }),
      C('Atlas Engenharia', 'A', SMTR(0.66), f3(5300), { SM: 1, TR: 1, DS: 1, CS: 1 }, { pont: { 9: [8000, 'Consultoria de marca', 'Projetos e consultoria'] }, dir: { 9: [['freelas', 1200, 'Consultor de naming']] } }),
      C('Solar Energia ES', 'B', SMTR(0.6), { 7: 4000, 8: 5200, 9: 5200 }, { SM: 1, TR: 1, DS: 1, CS: 1 }, { pont: { 8: [8000, 'Vídeo institucional', 'Audiovisual'] }, vp: { 8: { AV: 2 } }, dir: { 8: [['freelas', 2800, 'Captação e drone']] } }),
      C('Clínica Vitta', 'A', SMTR(0.67), f3(4800), { SM: 1, TR: 1, DS: 1, AV: 1, CS: 1 }, { dir: { 9: [['materiais', 780, 'Gráfica Rápida ES']] } }),
      C('APTO', 'A', SMTR(0.67), { 7: 4000, 8: 4000, 9: 4500 }, { SM: 1, TR: 1, DS: 1, CS: 1 }),
      C('Verde Vale', 'B', SMTR(0.6), { 9: 3800 }, { SM: 1, TR: 1, DS: 1, CS: 1 }),
      C('Pão de Mel Confeitaria', 'B', [['Social Media', 1]], f3(3500), { SM: 1, DS: 1, CS: 1 }),
      C('Café Aroma', 'B', SMTR(0.7), { 7: 3400, 8: 3400, 9: 3100 }, { SM: 1, TR: 1, DS: 1, CS: 1 }, { dir: { 9: [['freelas', 950, 'Pedro Alves, fotografia']] } }),
      C('BNEX', 'B', [['Social Media', 1]], f3(3300), { SM: 2, DS: 2, AV: 1.5, CS: 1 }, { dir: { 7: [['materiais', 400, 'Impressos']], 8: [['materiais', 400, 'Impressos']], 9: [['materiais', 400, 'Impressos']] }, esf: [12, 20] }),
      C('Mar Azul Pousada', 'A', SMTR(0.6), { 7: 3200, 8: 3200, 9: 3900 }, { SM: 1, TR: 1, DS: 1, CS: 1 }),
      C('Ótica Visão Clara', 'B', [['Social Media', 1]], f3(2900), { SM: 1, DS: 1, CS: 1 }),
      C('Casa Nómade', 'B', [['Social Media', 1]], f3(2600), { SM: 1, DS: 1, CS: 1 }),
      C('Autoescola Rota', 'B', [['Tráfego pago', 1]], { 7: 1950, 8: 2450, 9: 2450 }, { TR: 1, CS: 1 }),
      C('Studio Pilates Ápice', 'B', [['Social Media', 1]], f3(2200), { SM: 1, DS: 1, CS: 1 }),
      C('Padaria Trigo Fino', 'A', [['Tráfego pago', 1]], f3(1800), { TR: 1, CS: 1 }),
      C('Estúdio Brisa', 'B', [['Social Media', 1]], f3(1650), { SM: 1, DS: 0.5, CS: 1 }),
      C('Nuvem Pet', 'A', [['Tráfego pago', 1]], f3(1500), { TR: 1, CS: 1 }),
      C('Floricultura Jardim', 'B', [['Social Media', 1]], { 7: 1200, 8: 1200 }, { SM: 0.5, CS: 1 }),
      C('Studio Yoga Leve', 'B', [['Social Media', 1]], { 7: 900, 8: 900 }, { SM: 0.5, CS: 1 }),
      C('Grupo Orla', 'A', [['Audiovisual', 1]], {}, {}, { pont: { 8: [6000, 'Vídeo institucional 1/3', 'Audiovisual'], 9: [6000, 'Vídeo institucional 2/3', 'Audiovisual'] }, vp: { 8: { AV: 2, CS: 0.5 }, 9: { AV: 2, CS: 0.5 } }, dir: { 8: [['locacao', 1200, 'LocaCine, lente']], 9: [['locacao', 2600, 'LocaCine, lente e iluminação'], ['freelas', 1850, 'Lucas Prado, captação'], ['freelas', 600, 'Adicional de gravação']] } }),
      C('Construtora Horizonte', 'B', [['Projetos e consultoria', 1]], {}, {}, { pont: { 8: [6500, 'Diagnóstico de marca', 'Projetos e consultoria'] } })
    ];
    const ROLES = { SM: ['Social Media', 7000, 22], TR: ['Tráfego pago', 5500, 16], DS: ['Design', 4200, 18], AV: ['Audiovisual', 8300, 14], CS: ['Relacionamento (CS)', 3800, 24] };
    const STRUCT = { 7: { prolabore: 11000, inss: 1210, admin: 5000, comercial: 3300, estrutura: 5310, contab: 1400, softwares: 7600, transp: 590 }, 8: { prolabore: 11000, inss: 1210, admin: 5000, comercial: 3700, estrutura: 5310, contab: 1400, softwares: 8000, transp: 520 }, 9: { prolabore: 11000, inss: 1210, admin: 5000, comercial: 4150, estrutura: 5310, contab: 1400, softwares: 9440, transp: 480 } };
    const FIN = { 7: { juros: 120, tarifas: -230, rend: 0 }, 8: { juros: 80, tarifas: -170, rend: 0 }, 9: { juros: 139, tarifas: -182, rend: 18 } };
    const OPG = { 7: 500, 8: 520, 9: 610 };
    const RB12 = [86400, 89100, 91200, 90800, 93500, 95000, 98500, 104200, 101800, 109600, 114300, 119000];
    const MRR12 = [72000, 74300, 76100, 77000, 79800, 82400, 84900, 88600, 91900, 92100, 93800, 96400];
    const MLAB = ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
    this._d = { clients, ROLES, STRUCT, FIN, OPG, RB12, MRR12, MLAB };
    return this._d;
  }
  monthCalc(m) {
    const D = this.data();
    const used = { SM: 0, TR: 0, DS: 0, AV: 0, CS: 0 };
    D.clients.forEach((c) => { if (c.fee[m]) Object.keys(c.vagas).forEach((r) => used[r] += c.vagas[r]); const vp = c.vp[m] || {}; Object.keys(vp).forEach((r) => used[r] += vp[r]); });
    const vc = {}; const ocios = {}; Object.keys(D.ROLES).forEach((r) => { const [, cost, cap] = D.ROLES[r]; vc[r] = cost / Math.max(cap, used[r]); ocios[r] = Math.max(0, cost - used[r] * vc[r]); });
    const cl = D.clients.map((c) => {
      const fee = c.fee[m] || 0; const p = c.pont[m]; const pon = p ? p[0] : 0; const rec = fee + pon; const ded = rec * 0.06;
      const vg = {}; if (fee) Object.keys(c.vagas).forEach((r) => vg[r] = (vg[r] || 0) + c.vagas[r]); Object.keys(c.vp[m] || {}).forEach((r) => vg[r] = (vg[r] || 0) + c.vp[m][r]);
      const eqBy = {}; let eq = 0; Object.keys(vg).forEach((r) => { eqBy[r] = vg[r] * vc[r]; eq += eqBy[r]; });
      const dirs = c.dir[m] || []; const dir = dirs.reduce((a, d) => a + d[1], 0);
      return { c, fee, pon, pLabel: p ? p[1] : '', pSrv: p ? p[2] : null, rec, ded, vg, eqBy, eq, dirs, dir, mg: rec - ded - eq - dir, vagas: Object.values(vg).reduce((a, b) => a + b, 0) };
    });
    const L = { mens: 0, pont: 0, das: 0, equipe: 0, freelas: 0, locacao: 0, audio: 0, materiais: D.OPG[m] };
    cl.forEach((x) => { L.mens += x.fee; L.pont += x.pon; x.dirs.forEach((d) => L[d[0]] += d[1]); });
    L.das = (L.mens + L.pont) * 0.06; L.equipe = Object.values(D.ROLES).reduce((a, r) => a + r[1], 0);
    Object.assign(L, D.STRUCT[m], D.FIN[m]);
    return { L, cl, used, vc, ocios, m };
  }
  synth(i) {
    const D = this.data(); const rb = D.RB12[i]; const mrr = D.MRR12[i]; const k = rb / 114300;
    const eqArr = [24600, 24600, 25800, 25800, 25800, 27000, 27000, 28800, 28800];
    return { mens: mrr, pont: rb - mrr, das: rb * 0.06, equipe: eqArr[i] || 28800, freelas: 3800 * k, locacao: 1000 * k, audio: 300 * k, materiais: 800 * k, prolabore: 11000, inss: 1210, admin: 5000, comercial: 3000 + (i % 3) * 200, estrutura: 5100, contab: 1400, softwares: 6800 + i * 100, transp: 500, juros: 90, tarifas: -190, rend: 0 };
  }
  linesIdx(i) { return i >= 9 ? this.monthCalc(i - 2).L : this.synth(i); }
  sum(arr) { const o = {}; arr.forEach((L) => Object.keys(L).forEach((k) => o[k] = (o[k] || 0) + L[k])); return o; }
  groups(L) {
    const rb = L.mens + L.pont; const ded = L.das; const rl = rb - ded; const cd = L.equipe + L.freelas + L.locacao + L.audio + L.materiais; const mb = rl - cd;
    const dop = L.prolabore + L.inss + L.admin + L.comercial + L.estrutura + L.contab + L.softwares + L.transp; const ro = mb - dop; const fin = L.juros + L.tarifas + L.rend; const rliq = ro + fin;
    return { rb, ded, rl, cd, mb, dop, ro, fin, rliq };
  }
  renderVals() {
    const s = this.state; const accent = this.props.accent ?? '#A99BFF'; const D = this.data(); const nav = (t) => () => this.say(t);
    const MN = { 7: 'Julho', 8: 'Agosto', 9: 'Setembro' };
    const months = s.gran === 'mes' ? [s.mes] : [7, 8, 9];
    const calcs = months.map((m) => this.monthCalc(m));
    const L = this.sum(calcs.map((c) => c.L)); const G = this.groups(L);
    let Lc;
    if (s.comp === 'ant') Lc = s.gran === 'mes' ? this.linesIdx(s.mes + 1) : this.sum([6, 7, 8].map((i) => this.linesIdx(i)));
    else if (s.comp === 'yoy') { Lc = {}; Object.keys(L).forEach((k) => Lc[k] = L[k] * (['mens', 'pont', 'das'].includes(k) ? 0.8 : ['juros', 'tarifas', 'rend'].includes(k) ? 1 : 0.88)); }
    else { const n = months.length; const B = { mens: 93000, pont: 15000, das: 6480, equipe: 28800, freelas: 4000, locacao: 2000, audio: 500, materiais: 1000, prolabore: 11000, inss: 1210, admin: 5000, comercial: 3500, estrutura: 5310, contab: 1400, softwares: 8000, transp: 600, juros: 100, tarifas: -200, rend: 0 }; Lc = {}; Object.keys(B).forEach((k) => Lc[k] = B[k] * n); }
    const Gc = this.groups(Lc);
    const compLabel = s.comp === 'ant' ? (s.gran === 'mes' ? { 7: 'junho', 8: 'julho', 9: 'agosto' }[s.mes] : '2º trimestre') : s.comp === 'yoy' ? 'mesmo período de 2025' : 'o orçado';
    const perLabel = s.gran === 'mes' ? MN[s.mes] + ' 2026' : '3º trimestre de 2026';
    const aberto = s.gran === 'tri' || s.mes === 9;
    const selo = s.gran === 'mes' && s.mes === 8 ? { txt: 'Fechado, 2 ajustes após o fechamento', fg: '#EDB866', bg: 'rgba(237,184,102,0.1)', border: 'rgba(237,184,102,0.35)' } : aberto ? { txt: 'Em aberto, 58% realizado', fg: '#EDB866', bg: 'rgba(237,184,102,0.1)', border: 'rgba(237,184,102,0.35)' } : { txt: 'Fechado', fg: '#6FD3A2', bg: 'rgba(111,211,162,0.1)', border: 'rgba(111,211,162,0.35)' };
    const dlt = (a, b, inv) => { const d = a - b; const good = inv ? d < 0 : d > 0; return { t: (d >= 0 ? '+' : '−') + this.pct(Math.abs(d), Math.abs(b) || 1), c: Math.abs(d) < 1 ? '#A6A9B1' : good ? '#6FD3A2' : '#F08A84' }; };
    const ppDelta = (a, b) => { const d = (a - b) * 100; return { t: (d >= 0 ? '+' : '−') + Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' p.p.', c: d >= 0 ? '#6FD3A2' : '#F08A84' }; };
    const k1 = dlt(G.rl, Gc.rl), k2 = ppDelta(G.mb / G.rl, Gc.mb / Gc.rl), k3 = dlt(G.ro, Gc.ro), k4 = dlt(G.rliq, Gc.rliq);
    const kpis = [
      { label: 'Receita líquida', val: this.money0(G.rl), delta: k1.t, dColor: k1.c, sub: 'vs. ' + compLabel },
      { label: 'Margem bruta', val: this.pct(G.mb, G.rl), delta: k2.t, dColor: k2.c, sub: this.money0(G.mb) },
      { label: 'Resultado operacional', val: this.money0(G.ro), delta: k3.t, dColor: k3.c, sub: 'margem de ' + this.pct(G.ro, G.rl) },
      { label: 'Resultado líquido', val: this.money0(G.rliq), delta: k4.t, dColor: k4.c, sub: 'vs. ' + compLabel }
    ];
    const tabs = [['dre', 'DRE'], ['rent', 'Rentabilidade'], ['rec', 'Receita']].map(([k, label]) => ({ label, on: s.tab === k, fg: s.tab === k ? '#EEEEF0' : '#A6A9B1', fw: s.tab === k ? '600' : '500', line: s.tab === k ? accent : 'transparent', pick: () => this.setState({ tab: k }) }));
    const grans = [['mes', 'Mês'], ['tri', 'Trimestre']].map(([k, label]) => ({ label, on: s.gran === k, bg: s.gran === k ? '#2C2F36' : 'transparent', fg: s.gran === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ gran: k, cli: null }) }));

    // PARA CADA 100
    const rb = G.rb; const segDefs = [['Impostos', L.das, '#8F93A0'], ['Equipe de entrega', L.equipe, '#5A5480'], ['Custos diretos', L.freelas + L.locacao + L.audio + L.materiais, '#7B6FC4'], ['Pró-labore, comercial e adm.', L.prolabore + L.inss + L.admin + L.comercial, '#4A4E58'], ['Estrutura e softwares', L.estrutura + L.contab + L.softwares + L.transp, '#6E727B'], ['Financeiro', Math.max(0, -(L.juros + L.tarifas + L.rend)), '#3A3D46']];
    const used100 = segDefs.reduce((a, d) => a + d[1], 0); segDefs.push(['Resultado', rb - used100, accent]);
    const cem = { sub: 'Receita bruta de ' + this.money0(rb) + ' em ' + perLabel.toLowerCase(), segs: segDefs.map((d) => { const v = d[1] / rb * 100; return { label: d[0], v: v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), w: v.toFixed(2) + '%', bg: d[2], fg: d[0] === 'Resultado' ? '#15131F' : '#EEEEF0', short: v >= 6 ? 'R$ ' + Math.round(v) : '' }; }) };

    // DRE
    const DRE = [
      { k: 'rb', label: 'Receita bruta', kids: [['mens', 'Mensalidades (recorrente)'], ['pont', 'Projetos e pontuais']], sign: 1 },
      { k: 'ded', label: '(−) Deduções', kids: [['das', 'DAS (Simples Nacional)']], sign: -1 },
      { k: 'rl', label: 'Receita líquida', total: true },
      { k: 'cd', label: '(−) Custos diretos', kids: [['equipe', 'Equipe de entrega'], ['freelas', 'Freelancers e adicionais'], ['locacao', 'Locação de equipamento'], ['audio', 'Produção de áudio'], ['materiais', 'Materiais e impressão']], sign: -1 },
      { k: 'mb', label: 'Margem bruta', total: true },
      { k: 'dop', label: '(−) Despesas operacionais', kids: [['prolabore', 'Pró-labore'], ['inss', 'Encargos sobre pró-labore'], ['admin', 'Equipe administrativa'], ['comercial', 'Comercial, fixo e comissões'], ['estrutura', 'Estrutura: aluguel, energia, internet'], ['contab', 'Contabilidade'], ['softwares', 'Softwares'], ['transp', 'Transporte e alimentação']], sign: -1 },
      { k: 'ro', label: 'Resultado operacional', total: true },
      { k: 'fin', label: '(±) Resultado financeiro', kids: [['juros', 'Juros e multas recebidos'], ['tarifas', 'Tarifas e taxas'], ['rend', 'Rendimentos']], sign: 1 },
      { k: 'rliq', label: 'Resultado líquido', total: true, strong: true }
    ];
    const catSign = {}; DRE.forEach((r) => (r.kids || []).forEach((k) => catSign[k[0]] = r.sign));
    const REAL = { mens: 0.62, pont: 0.55, das: 0, equipe: 0, freelas: 0.4, locacao: 0, audio: 0.5, materiais: 1, prolabore: 0, inss: 0, admin: 0, comercial: 0, estrutura: 0.9, contab: 1, softwares: 0.85, transp: 1, juros: 1, tarifas: 1, rend: 1 };
    const ajCats = s.gran === 'mes' && s.mes === 8 ? ['softwares', 'freelas'] : [];
    const openLanc = (cat, label, mm) => () => this.setState({ lanc: { cat, label, months: mm || months } });
    const colsMode = s.modo === 'evo' ? 'evo' : (s.gran === 'mes' && s.mes === 9 ? 'aberto' : 'per');
    let head, cols, minW;
    const idxs12 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; const L12 = idxs12.map((i) => this.linesIdx(i)); const G12 = L12.map((x) => this.groups(x));
    if (colsMode === 'per') { head = ['Valor', '% RL', 'Comparação', 'Δ', 'Δ%']; cols = '270px repeat(5, minmax(0, 1fr))'; minW = 700; }
    else if (colsMode === 'aberto') { head = ['Realizado', 'Previsto', 'Total', '% RL', 'Comparação', 'Δ']; cols = '250px repeat(6, minmax(0, 1fr))'; minW = 760; }
    else { head = D.MLAB.map((m) => m); cols = '250px repeat(12, 96px)'; minW = 250 + 12 * 96; }
    const rowCells = (valFn, cmpFn, sign, cat, isTot) => {
      const v = valFn(L, G); const vc = cmpFn(Lc, Gc); const disp = (x) => this.num0(sign === -1 ? -x : x);
      const color = (x) => (sign === -1 ? '#EEEEF0' : x < 0 ? '#F08A84' : '#EEEEF0');
      const clickable = !!cat; const op = clickable ? openLanc(cat, null) : () => {};
      const dd = v - vc; const good = sign === -1 ? dd < 0 : dd > 0; const dColor = Math.abs(dd) < 1 ? '#8F93A0' : good ? '#6FD3A2' : '#F08A84';
      const base = (t, c, extra) => Object.assign({ v: t, color: c || '#EEEEF0', open: op, off: !clickable, cursor: clickable ? 'pointer' : 'default', hasSub: false, sub: '' }, extra || {});
      if (colsMode === 'evo') return idxs12.map((i) => { const x = valFn(L12[i], G12[i]); return base(disp(x), color(x), { hasSub: true, sub: this.pct(Math.abs(x), G12[i].rl), open: clickable ? openLanc(cat, null, i >= 9 ? [i - 2] : []) : () => {} }); });
      const pctTxt = this.pct(Math.abs(v), G.rl);
      const deltaTxt = (Math.abs(dd) < 1 ? '—' : (sign === -1 ? (dd > 0 ? '−' : '+') : (dd >= 0 ? '+' : '−')) + Math.abs(Math.round(dd)).toLocaleString('pt-BR'));
      const deltaPct = vc ? (dd >= 0 ? '+' : '−') + this.pct(Math.abs(dd), Math.abs(vc)) : '—';
      if (colsMode === 'per') return [base(disp(v), color(v)), base(pctTxt, '#A6A9B1'), base(disp(vc), '#A6A9B1'), base(deltaTxt, dColor), base(deltaPct, dColor)];
      const frac = cat ? REAL[cat] : null;
      const realV = cat ? v * frac : null;
      return [base(cat ? disp(realV) : '', '#EEEEF0'), base(cat ? disp(v - realV) : '', '#8F93A0'), base(disp(v), color(v)), base(pctTxt, '#A6A9B1'), base(disp(vc), '#A6A9B1'), base(deltaTxt, dColor)];
    };
    const rows = [];
    DRE.forEach((r) => {
      if (r.total) { rows.push({ isGroup: false, isPlain: true, label: r.label, indent: 16, fw: r.strong ? '700' : '600', labelColor: '#EEEEF0', bg: '#1A1C20', stickyBg: '#1A1C20', line: '#2A2D33', ajuste: false, cells: rowCells((l, g) => g[r.k], (l, g) => g[r.k], 1, null, true) }); return; }
      const op = !!s.open[r.k];
      rows.push({ isGroup: true, isPlain: false, label: r.label, chev: op ? 'rotate(90deg)' : 'none', toggle: () => { const o = Object.assign({}, s.open); o[r.k] = !op; this.setState({ open: o }); }, fw: '600', bg: 'transparent', stickyBg: '#1D1F24', line: '#25282D', ajuste: false, cells: rowCells((l, g) => g[r.k], (l, g) => g[r.k], r.sign, null) });
      if (op) r.kids.forEach((kd) => rows.push({ isGroup: false, isPlain: true, label: kd[1], indent: 38, fw: '400', labelColor: '#C9CBD1', bg: 'transparent', stickyBg: '#1D1F24', line: '#25282D', ajuste: ajCats.includes(kd[0]), cells: rowCells((l) => l[kd[0]], (l) => l[kd[0]], r.sign, kd[0]) }));
    });
    const dre = { head: head.map((t) => ({ t })), cols, minW: String(minW), rows };
    const modos = [['periodo', 'Período'], ['evo', 'Evolução mensal']].map(([k, label]) => ({ label, on: s.modo === k, bg: s.modo === k ? '#2C2F36' : 'transparent', fg: s.modo === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ modo: k }) }));

    // VARIAÇÃO
    const catLabel = {}; DRE.forEach((r) => (r.kids || []).forEach((k) => catLabel[k[0]] = k[1]));
    const NOTES = { 9: { mens: 'Verde Vale entrou; APTO e Mar Azul expandiram; Floricultura pausou e Studio Yoga saiu', pont: 'Sabor do Mar (campanha de verão) e Atlas (consultoria) no lugar de Solar e Horizonte', freelas: 'Captação do Grupo Orla, consultor de naming e fotografia do Café Aroma', softwares: '118% do orçado: Frame.io e Envato novos no cartão', locacao: 'Lente e iluminação do vídeo do Grupo Orla', audio: 'Trilha da campanha do Sabor do Mar', comercial: 'Comissão de 2 negócios ganhos em agosto' }, 8: { mens: 'Solar Energia e Autoescola Rota expandiram', pont: 'Vídeo da Solar, diagnóstico da Horizonte e vídeo do Grupo Orla', freelas: 'Captação e drone do vídeo da Solar', softwares: 'Reajuste do Adobe e nova licença do Figma', comercial: 'Comissão de julho' }, 7: {} };
    const impacts = Object.keys(catSign).map((k) => ({ k, imp: (L[k] - Lc[k]) * catSign[k] * (k === 'das' ? 1 : 1) })).map((x) => Object.assign(x, { imp: ['das', 'equipe', 'freelas', 'locacao', 'audio', 'materiais', 'prolabore', 'inss', 'admin', 'comercial', 'estrutura', 'contab', 'softwares', 'transp'].includes(x.k) ? -(L[x.k] - Lc[x.k]) : (L[x.k] - Lc[x.k]) })).sort((a, b) => Math.abs(b.imp) - Math.abs(a.imp));
    const top = impacts.slice(0, 5); const rest = impacts.slice(5).reduce((a, x) => a + x.imp, 0);
    const dRes = G.rliq - Gc.rliq; const nts = s.gran === 'mes' && s.comp === 'ant' ? (NOTES[s.mes] || {}) : {};
    const varc = { sub: 'Resultado líquido vs. ' + compLabel, total: (dRes >= 0 ? '+' : '−') + this.money0(Math.abs(dRes)), color: dRes >= 0 ? '#6FD3A2' : '#F08A84', demais: (rest >= 0 ? '+' : '−') + this.money0(Math.abs(rest)),
      items: top.map((x) => ({ label: catLabel[x.k], v: (x.imp >= 0 ? '+' : '−') + this.money0(Math.abs(x.imp)), color: x.imp >= 0 ? '#6FD3A2' : '#F08A84', arrow: x.imp >= 0 ? '▲' : '▼', hasNote: !!nts[x.k], note: nts[x.k] || '', open: openLanc(x.k, null) })) };
    const invMap = { 7: 0, 8: 0, 9: 1890 }; const socMap = { 7: 0, 8: 0, 9: 60000 };
    const fora = { inv: this.num0(-months.reduce((a, m) => a + invMap[m], 0)), soc: this.num0(-months.reduce((a, m) => a + socMap[m], 0)) };

    // PONTE CAIXA
    const PB = { 7: [-4200, 2100, 0, 0, -5000], 8: [-6300, 1800, 0, 0, -5000], 9: [-28400, 48900, -1890, -60000, 0] };
    const pb = [0, 1, 2, 3, 4].map((j) => months.reduce((a, m) => a + PB[m][j], 0));
    const wf = (items, H) => { let run = 0; const pts = []; items.forEach((it) => { if (it.kind === 'start') { pts.push([0, it.v]); run = it.v; } else if (it.kind === 'end') { pts.push([0, run]); } else { pts.push([run, run + it.v]); run += it.v; } }); const all = pts.flat().concat([0]); const mx = Math.max(...all), mn = Math.min(...all); const Y = (v) => 18 + (H - 58) * (mx - v) / ((mx - mn) || 1);
      return items.map((it, j) => { const [a, b] = pts[j]; const top = Y(Math.max(a, b)); const h = Math.max(2, Math.abs(Y(a) - Y(b))); const val = it.kind === 'delta' ? it.v : b; const neg = val < 0; return { label: it.label, v: (it.kind === 'delta' ? (val >= 0 ? '+' : '−') : (val < 0 ? '−' : '')) + (Math.abs(val) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil', top: top.toFixed(1), h: h.toFixed(1), valTop: (top - 17).toFixed(1), bg: it.kind === 'delta' ? (neg ? '#F08A84' : '#6FD3A2') : (it.color || accent), valColor: it.kind === 'delta' ? (neg ? '#F08A84' : '#6FD3A2') : '#EEEEF0' }; }); };
    const final = G.rliq + pb.reduce((a, b) => a + b, 0);
    const ponteCx = wf([{ kind: 'start', v: G.rliq, label: 'Resultado líquido' }, { kind: 'delta', v: pb[0], label: 'Recebíveis' }, { kind: 'delta', v: pb[1], label: 'Contas a pagar' }, { kind: 'delta', v: pb[2], label: 'Investimentos' }, { kind: 'delta', v: pb[3], label: 'Distribuição de lucros' }, { kind: 'delta', v: pb[4], label: 'Aplicação na reserva' }, { kind: 'end', label: 'Variação do caixa', color: final < 0 ? '#F08A84' : '#6FD3A2' }].filter((it) => it.kind !== 'delta' || Math.abs(it.v) > 0.5), 240);

    // LANÇAMENTOS
    let lanc = { itens: [] };
    if (s.lanc) {
      const cat = s.lanc.cat; const mm = s.lanc.months; const its = [];
      mm.forEach((m) => { const cc = this.monthCalc(m); const d0 = '/' + String(m).padStart(2, '0'); const ml = { 7: 'jul', 8: 'ago', 9: 'set' }[m];
        if (cat === 'mens') cc.cl.filter((x) => x.fee).forEach((x) => its.push({ d: ml, l: x.c.nome + ', mensalidade', raw: x.fee }));
        else if (cat === 'pont') cc.cl.filter((x) => x.pon).forEach((x) => its.push({ d: ml, l: x.c.nome + ', ' + x.pLabel.toLowerCase(), raw: x.pon }));
        else if (cat === 'das') its.push({ d: '20' + d0, l: 'DAS, competência ' + MN[m].toLowerCase() + ' (6% da receita bruta)', raw: cc.L.das });
        else if (cat === 'equipe') Object.keys(D.ROLES).forEach((r) => its.push({ d: '05' + d0, l: D.ROLES[r][0] + ', ' + cc.used[r].toLocaleString('pt-BR') + ' de ' + D.ROLES[r][2] + ' vagas', raw: D.ROLES[r][1] }));
        else if (['freelas', 'locacao', 'audio', 'materiais'].includes(cat)) { cc.cl.forEach((x) => x.dirs.filter((d) => d[0] === cat).forEach((d) => its.push({ d: ml, l: d[2] + ', ' + x.c.nome, raw: d[1] }))); if (cat === 'materiais') its.push({ d: ml, l: 'Materiais gerais, Operação geral', raw: D.OPG[m] }); }
        else { const BRK = { prolabore: [['Iago Lima', 5500], ['Flávio', 5500]], inss: [['INSS sobre pró-labore', 1210]], admin: [['Equipe administrativa (valor por pessoa restrito)', 5000]], estrutura: [['Aluguel, Imobiliária Praia Mar', 4200], ['Energia, EDP', 300], ['Internet, Vivo Empresas', 490], ['Seguro de equipamentos', 320]], contab: [['Contabilidade Ágil', 1400]], transp: [['Transporte e alimentação de gravações', cc.L.transp]], comercial: [['Comercial, fixo', 2800], ['Comissões', cc.L.comercial - 2800]], softwares: [['Adobe, Canva, Figma, Notion, Envato e outros (cartão)', cc.L.softwares - 370], ['Google Workspace', 370]], juros: [['Juros e multas recebidos de clientes', cc.L.juros]], tarifas: [['Tarifas bancárias e taxas do Asaas', cc.L.tarifas]], rend: [['Rendimento da aplicação automática', cc.L.rend]] }; (BRK[cat] || []).forEach((b) => its.push({ d: ml, l: b[0], raw: b[1] })); }
      });
      const tot = its.reduce((a, x) => a + x.raw, 0);
      lanc = { per: perLabel + (mm.length === 0 ? ' (mês sem detalhe no protótipo)' : ''), titulo: catLabel[cat], total: this.money0(tot), sub: its.length + (its.length === 1 ? ' item' : ' itens') + ', por competência', itens: its.map((x) => ({ d: x.d, l: x.l, v: this.num0(x.raw), open: nav('Abriria a ficha universal do lançamento') })), hasNota: cat === 'equipe' || cat === 'admin', nota: 'Equipe aparece por função. O valor por pessoa fica restrito a quem tem permissão de ver remuneração, em Pagamentos, Folha.' };
    }

    // RENTABILIDADE
    const agg = {}; calcs.forEach((cc) => cc.cl.forEach((x) => { const a = agg[x.c.nome] || (agg[x.c.nome] = { c: x.c, rec: 0, ded: 0, eq: 0, dir: 0, mg: 0, vagas: 0, eqBy: {}, dirs: [], n: 0 }); a.rec += x.rec; a.ded += x.ded; a.eq += x.eq; a.dir += x.dir; a.mg += x.mg; a.vagas += x.vagas; a.n += 1; Object.keys(x.eqBy).forEach((r) => a.eqBy[r] = (a.eqBy[r] || 0) + x.eqBy[r]); x.dirs.forEach((d) => a.dirs.push(d)); }));
    const clis = Object.values(agg).filter((a) => a.rec > 0).map((a) => Object.assign(a, { rl: a.rec - a.ded, mgp: (a.rec - a.ded) ? a.mg / (a.rec - a.ded) : 0, vagasAvg: a.vagas / months.length }));
    const health = (p) => p >= 0.55 ? ['Saudável', '#6FD3A2', 'rgba(111,211,162,0.13)'] : p >= 0.4 ? ['Atenção', '#EDB866', 'rgba(237,184,102,0.14)'] : ['Crítica', '#F08A84', 'rgba(240,138,132,0.14)'];
    const ociosT = calcs.reduce((a, cc) => a + Object.values(cc.ocios).reduce((x, y) => x + y, 0), 0);
    const opgT = months.reduce((a, m) => a + D.OPG[m], 0);
    const mgT = clis.reduce((a, c) => a + c.mg, 0);
    const prova = [{ label: 'Margem de contribuição', v: this.money0(mgT), color: '#EEEEF0', op: true, opTxt: '−' }, { label: 'Capacidade ociosa', v: this.money0(ociosT), color: '#EDB866', op: true, opTxt: '−' }, { label: 'Operação geral', v: this.money0(opgT), color: '#EEEEF0', op: true, opTxt: '−' }, { label: 'Estrutura', v: this.money0(G.dop), color: '#EEEEF0', op: true, opTxt: (G.fin >= 0 ? '+' : '−') }, { label: 'Financeiro', v: this.money0(Math.abs(G.fin)), color: '#EEEEF0', op: true, opTxt: '=' }, { label: 'Resultado líquido', v: this.money0(mgT - ociosT - opgT - G.dop + G.fin), color: accent, op: false, opTxt: '' }];
    const alertas = []; calcs.forEach((cc) => Object.keys(D.ROLES).forEach((r) => { if (cc.used[r] > D.ROLES[r][2]) alertas.push({ t: D.ROLES[r][0] + ' acima da capacidade em ' + MN[cc.m].toLowerCase() + ': ' + cc.used[r].toLocaleString('pt-BR') + ' vagas usadas de ' + D.ROLES[r][2] + '. O custo por vaga cai, mas a equipe está sobrecarregada.', cta: 'Ver alocação', go: nav('Abriria a alocação da função em Pagamentos, Folha') }); }));
    const dims = [['cli', 'Clientes'], ['srv', 'Serviços'], ['proj', 'Projetos'], ['sq', 'Squads']].map(([k, label]) => ({ label, on: s.dim === k, bg: s.dim === k ? '#2C2F36' : 'transparent', fg: s.dim === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ dim: k }) }));
    const spark = (nome, p) => { const pts = []; for (let i = 0; i < 6; i++) { const seed = (nome.length * 7 + i * 13) % 11; pts.push(p + (seed - 5) / 100 * (i < 5 ? 1 : 0)); } pts[5] = p; const mx = Math.max(...pts, 0.01), mn = Math.min(...pts, 0); return 'M ' + pts.map((v, i) => (2 + i * 15).toFixed(1) + ' ' + (3 + 16 * (mx - v) / ((mx - mn) || 1)).toFixed(1)).join(' L '); };
    const cliSorted = clis.slice().sort((a, b) => a.mgp - b.mgp);
    const cliRows = cliSorted.map((a) => { const h = health(a.mgp); return { nome: a.c.nome, servs: a.c.servs.map((x) => x[0]).join(', ') + (a.dirs.length || (a.c.pont && months.some((m) => a.c.pont[m])) ? '' : ''), rec: this.num0(a.rec), ded: this.num0(-a.ded), eq: this.num0(-a.eq), dir: this.num0(-a.dir), mg: this.num0(a.mg), mgp: this.pct(a.mg, a.rl), mgColor: h[1], vagas: a.vagasAvg.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), spark: spark(a.c.nome, a.mgp), sparkColor: h[1], health: h[0], hFg: h[1], hBg: h[2], open: () => this.setState({ cli: a.c.nome, simFee: '' }) }; });
    const totRec = clis.reduce((x, c) => x + c.rec, 0);
    const cliFoot = [
      { label: 'Carteira', rec: this.num0(totRec), eq: this.num0(-clis.reduce((x, c) => x + c.eq, 0)), dir: this.num0(-clis.reduce((x, c) => x + c.dir, 0)), mg: this.num0(mgT), mgp: this.pct(mgT, clis.reduce((x, c) => x + c.rl, 0)), note: '', bg: '#1A1C20', color: '#EEEEF0', fw: '600' },
      { label: 'Operação geral', rec: '', eq: '', dir: this.num0(-opgT), mg: this.num0(-opgT), mgp: '', note: 'Sem cliente', bg: 'transparent', color: '#C9CBD1', fw: '400' },
      { label: 'Capacidade ociosa', rec: '', eq: this.num0(-ociosT), dir: '', mg: this.num0(-ociosT), mgp: '', note: 'Vagas livres', bg: 'transparent', color: '#EDB866', fw: '400' }
    ];
    // matriz
    const maxRec = Math.max(...clis.map((c) => c.rec)) * 1.08; const yMin = Math.min(-0.2, Math.min(...clis.map((c) => c.mgp)) - 0.05), yMax = 1.0;
    const X = (v) => 60 + 1010 * v / maxRec; const Yp = (p) => 10 + 290 * (yMax - p) / (yMax - yMin);
    const avgRec = totRec / clis.length; const avgMg = mgT / clis.reduce((x, c) => x + c.rl, 0);
    const bigNames = clis.slice().sort((a, b) => b.rec - a.rec).slice(0, 4).map((c) => c.c.nome);
    const hov = clis.find((c) => c.c.nome === s.hovCli);
    const mx = { vx: X(avgRec).toFixed(1), hy: Yp(avgMg).toFixed(1), zeroY: Yp(0).toFixed(1),
      yl: [0.8, 0.4, 0, -0.2].filter((v) => v >= yMin).map((v) => ({ top: (Yp(v) - 7).toFixed(0), t: Math.round(v * 100) + '%' })),
      xl: [0, 0.25, 0.5, 0.75].map((f) => ({ left: (X(maxRec * f) - 10).toFixed(0), t: this.mil(maxRec * f) })),
      pts: clis.map((c) => { const h = health(c.mgp); const size = 10 + c.vagasAvg * 3.2; const cx = X(c.rec), cy = Yp(c.mgp); const show = bigNames.includes(c.c.nome) || c.mgp < 0.4; return { nome: c.c.nome, short: c.c.nome.split(' ').slice(0, 2).join(' '), left: (cx - size / 2).toFixed(1), top: (cy - size / 2).toFixed(1), size: size.toFixed(1), color: h[1], fill: h[2], showLabel: show, labelLeft: (cx + size / 2 + 4).toFixed(0), labelTop: (cy - 7).toFixed(0), open: () => this.setState({ cli: c.c.nome, simFee: '' }), enter: () => { if (this.state.hovCli !== c.c.nome) this.setState({ hovCli: c.c.nome }); } }; }),
      hasHov: !!hov, tip: hov ? { nome: hov.c.nome, rec: this.money0(hov.rec), mg: this.money0(hov.mg) + ' (' + this.pct(hov.mg, hov.rl) + ')', vagas: hov.vagasAvg.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) } : {}, tipLeft: hov ? String(Math.min(850, X(hov.rec) + 14)) : '0', tipTop: hov ? String(Math.max(0, Math.min(210, Yp(hov.mgp) - 40))) : '0' };

    // SERVIÇOS
    const SRV = ['Social Media', 'Tráfego pago', 'Audiovisual', 'Projetos e consultoria']; const RS = { SM: 'Social Media', TR: 'Tráfego pago', AV: 'Audiovisual' };
    const sa = {}; SRV.forEach((n) => sa[n] = { rec: 0, recR: 0, recP: 0, ded: 0, eq: 0, dir: 0, cl: new Set() });
    calcs.forEach((cc) => cc.cl.forEach((x) => { const ws = x.fee ? x.c.servs : (x.pSrv ? [[x.pSrv, 1]] : []); ws.forEach(([n, w]) => { sa[n].recR += x.fee * w; if (x.fee) sa[n].cl.add(x.c.nome); }); if (x.pon) { sa[x.pSrv].recP += x.pon; sa[x.pSrv].cl.add(x.c.nome); }
      Object.keys(x.eqBy).forEach((r) => { if (RS[r]) sa[RS[r]].eq += x.eqBy[r]; else { const wl = ws.length ? ws : [[x.pSrv || 'Audiovisual', 1]]; wl.forEach(([n, w]) => sa[n].eq += x.eqBy[r] * w); } });
      x.dirs.forEach((d) => { const tgt = x.pSrv || (x.c.servs.find((q) => q[0] === 'Audiovisual') && d[0] !== 'materiais' ? 'Audiovisual' : x.c.servs[0][0]); sa[tgt].dir += d[1]; }); }));
    SRV.forEach((n) => { const a = sa[n]; a.rec = a.recR + a.recP; a.ded = a.rec * 0.06; a.mg = a.rec - a.ded - a.eq - a.dir; });
    const maxS = Math.max(...SRV.map((n) => sa[n].rec));
    const srv = { bars: SRV.map((n) => { const a = sa[n]; const h = health(a.mg / (a.rec - a.ded)); return { nome: n, wRec: (a.recR / maxS * 100).toFixed(1) + '%', wPon: (a.recP / maxS * 100).toFixed(1) + '%', rec: this.money0(a.rec), mgp: this.pct(a.mg, a.rec - a.ded), mgColor: h[1], open: nav('Abriria a ficha do serviço: evolução em 12 meses, clientes que mais e menos contribuem e custo por função') }; }),
      rows: SRV.map((n) => { const a = sa[n]; const h = health(a.mg / (a.rec - a.ded)); return { nome: n, rec: this.num0(a.rec), pct: this.pct(a.rec, totRec), eq: this.num0(-a.eq), dir: this.num0(-a.dir), mg: this.num0(a.mg), mgp: this.pct(a.mg, a.rec - a.ded), mgColor: h[1], n: String(a.cl.size) }; }) };

    // PROJETOS
    const PROJ = [['Vídeo institucional', 'Grupo Orla', 'Em andamento', 18000, 5500, { 8: [6000, 1200, 2], 9: [6000, 5050, 2] }], ['Campanha de verão', 'Restaurante Sabor do Mar', 'Em andamento', 8600, 2500, { 9: [8600, 900, 1] }], ['Consultoria de marca', 'Atlas Engenharia', 'Concluído', 8000, 1500, { 9: [8000, 1200, 0] }], ['Vídeo institucional', 'Solar Energia ES', 'Concluído', 8000, 3000, { 8: [8000, 2800, 2] }], ['Diagnóstico de marca', 'Construtora Horizonte', 'Concluído', 6500, 500, { 8: [6500, 0, 0] }], ['Vídeo de matrícula', 'Colégio Horizonte Azul', 'Concluído', 9500, 3000, { 7: [9500, 3100, 2] }], ['Ensaio fotográfico', 'Vila Serrana Hotel', 'Concluído', 8000, 1000, { 7: [8000, 1100, 0] }], ['Campanha de lançamento', 'Construtora Horizonte', 'Em andamento', 18000, 4000, {}]];
    const projRows = PROJ.map((p) => { let rec = 0, custo = 0; months.forEach((m) => { const x = p[5][m]; if (x) { rec += x[0]; custo += x[1] + x[2] * this.monthCalc(m).vc.AV; } }); const acum = Object.values(p[5]).reduce((a, x) => a + x[1], 0); const mg = rec * 0.94 - custo; const over = acum > p[4]; const hp = rec ? health(mg / (rec * 0.94)) : ['', '#A6A9B1', '']; return { nome: p[0], cli: p[1], status: p[2], stFg: p[2] === 'Concluído' ? '#6FD3A2' : '#86B4F7', stBg: p[2] === 'Concluído' ? 'rgba(111,211,162,0.13)' : 'rgba(134,180,247,0.13)', contr: this.num0(p[3]), rec: rec ? this.num0(rec) : '—', custo: rec ? this.num0(-custo) : '—', mg: rec ? this.num0(mg) : '—', mgp: rec ? this.pct(mg, rec * 0.94) : '—', mgColor: hp[1], orcTxt: this.money0(acum) + ' de ' + this.money0(p[4]) + (over ? ', estourou' : ''), orcW: Math.min(100, acum / p[4] * 100).toFixed(0) + '%', orcColor: over ? '#F08A84' : acum / p[4] > 0.85 ? '#EDB866' : '#6FD3A2' }; });

    // SQUADS
    const sqAgg = { A: { rec: 0, custo: 0, mg: 0, sm: 0, n: new Set() }, B: { rec: 0, custo: 0, mg: 0, sm: 0, n: new Set() } };
    calcs.forEach((cc) => cc.cl.forEach((x) => { const q = sqAgg[x.c.sq]; if (!x.rec) return; q.rec += x.rec; q.custo += x.eq + x.dir; q.mg += x.mg; q.sm += (x.vg.SM || 0); q.n.add(x.c.nome); }));
    const squads = [['A', 'Squad A'], ['B', 'Squad B']].map(([k, nome]) => { const q = sqAgg[k]; const sm = q.sm / months.length; const oc = sm / 11; const col = oc > 1 ? '#F08A84' : oc > 0.9 ? '#EDB866' : '#6FD3A2'; return { nome, sub: q.n.size + ' clientes, 1 social media + funções compartilhadas', rec: this.money0(q.rec), custo: this.money0(q.custo), mg: this.money0(q.mg) + ' (' + this.pct(q.mg, q.rec * 0.94) + ')', mgColor: '#EEEEF0', oc: Math.round(oc * 100) + '%', ocW: Math.min(100, oc * 100).toFixed(0) + '%', ocColor: col, ocTxt: sm.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' de 11 vagas' + (oc > 1 ? '. Sobrecarregado: redistribuir clientes' : oc < 0.9 ? '. Espaço para ' + Math.floor(11 - sm) + ' cliente(s)' : '') }; });
    const lastCalc = calcs[calcs.length - 1];
    const funcoes = Object.keys(D.ROLES).map((r) => { const u = lastCalc.used[r], cap = D.ROLES[r][2]; const oc = u / cap; const col = oc > 1 ? '#F08A84' : oc > 0.9 ? '#EDB866' : '#6FD3A2'; return { nome: D.ROLES[r][0], w: Math.min(100, oc * 100).toFixed(0) + '%', color: col, oc: u.toLocaleString('pt-BR') + ' de ' + cap + ' vagas (' + Math.round(oc * 100) + '%)', txt: oc > 1 ? 'Acima da capacidade' : oc >= 0.95 ? 'No limite' : 'Espaço para ' + Math.floor(cap - u) + ' vaga(s)' }; });

    // FICHA CLIENTE
    let cf = { cascata: [], aloc: [], dir: [] };
    const ca = clis.find((c) => c.c.nome === s.cli);
    if (ca) {
      const h = health(ca.mgp); const steps = [['Receita', ca.rec, 'start']]; steps.push(['Deduções', -ca.ded, 'd']);
      Object.keys(ca.eqBy).forEach((r) => steps.push([D.ROLES[r][0], -ca.eqBy[r], 'd'])); if (ca.dir) steps.push(['Custos diretos', -ca.dir, 'd']); steps.push(['Margem', ca.mg, 'end']);
      let run = 0; const mxv = ca.rec; const cascata = steps.map((st) => { let a, b; if (st[2] === 'start') { a = 0; b = st[1]; run = b; } else if (st[2] === 'end') { a = 0; b = run; } else { a = run + st[1]; b = run; run += st[1]; } const lo = Math.max(0, Math.min(a, b)), hi = Math.max(a, b); return { label: st[0], left: (lo / mxv * 100).toFixed(1) + '%', w: Math.max(0.6, (hi - lo) / mxv * 100).toFixed(1) + '%', bg: st[2] === 'd' ? '#F08A84' : st[2] === 'end' ? (ca.mg < 0 ? '#F08A84' : accent) : '#6FD3A2', v: this.num0(st[1]), valColor: st[2] === 'd' ? '#C9CBD1' : '#EEEEF0', fw: st[2] === 'd' ? '400' : '600', lblColor: st[2] === 'd' ? '#C9CBD1' : '#EEEEF0' }; });
      const evoPts = []; for (let i = 0; i < 12; i++) evoPts.push(i >= 9 ? (this.monthCalc(i - 2).cl.find((x) => x.c.nome === ca.c.nome) || { mg: 0, rec: 1, ded: 0 }) : null);
      const evoV = evoPts.map((x, i) => x && x.rec ? x.mg / (x.rec - x.ded) : ca.mgp + (((ca.c.nome.length + i * 17) % 13) - 6) / 100);
      const eMx = 1, eMn = Math.min(-0.2, ...evoV) ; const evo = 'M ' + evoV.map((v, i) => (4 + i * 52.7).toFixed(1) + ' ' + (6 + 78 * (eMx - v) / (eMx - eMn)).toFixed(1)).join(' L ');
      const custoMes = (ca.eq + ca.dir) / ca.n; const feeAtual = ca.c.fee[months[months.length - 1]] || ca.rec / ca.n;
      const fee = this.parse(s.simFee) || feeAtual; const simMg = (fee * 0.94 - custoMes) / (fee * 0.94); const fee55 = custoMes / (0.94 * 0.45);
      const hs = health(simMg);
      const esf = ca.c.esf || [16, Math.round(16 * (1 + (((ca.c.nome.length * 3) % 9) - 4) / 50))];
      const ratio = esf[1] / esf[0] - 1;
      const lastM = months[months.length - 1]; const lastCC = this.monthCalc(lastM); const lastX = lastCC.cl.find((x) => x.c.nome === ca.c.nome) || { vg: {}, eqBy: {} };
      cf = { nome: ca.c.nome, health: h[0], hFg: h[1], hBg: h[2], sub: (ca.c.sq === 'A' ? 'Squad A' : 'Squad B') + ', ' + ca.c.servs.map((x) => x[0]).join(', ') + ', receita de ' + this.money0(ca.rec), mg: this.money0(ca.mg), mgp: this.pct(ca.mg, ca.rl), mgColor: h[1], cascata, evo, limY: (6 + 78 * (eMx - 0.55) / (eMx - eMn)).toFixed(1),
        hasEsforco: !!ca.c.fee[lastM], contr: esf[0] + ' entregas', real: esf[1] + ' entregas', esfColor: ratio > 0.2 ? '#F08A84' : '#EEEEF0', esfBorder: ratio > 0.2 ? 'rgba(240,138,132,0.4)' : '#2C2F36', esfBg: ratio > 0.2 ? 'rgba(240,138,132,0.06)' : 'transparent', esfTxt: ratio > 0.2 ? 'Recebe ' + Math.round(ratio * 100) + '% mais entregas do que contratou. A margem baixa vem de escopo escapando, não de preço: vale renegociar o escopo antes do fee.' : 'Esforço dentro do contratado (variação de ' + Math.round(ratio * 100) + '%). Se a margem estiver baixa, o problema é preço, não escopo.',
        simMg: this.pct(simMg * 100, 100), simColor: hs[1], simTxt: 'Fee atual de ' + this.money0(feeAtual) + ' e custo mensal de ' + this.money0(custoMes) + '. Para a margem chegar a 55% (saudável), o fee precisa ser de ' + this.money0(fee55) + (fee55 > feeAtual ? ', um reajuste de ' + this.pct(fee55 - feeAtual, feeAtual) + '.' : '. O fee atual já passa desse ponto.'),
        aloc: Object.keys(lastX.vg || {}).map((r) => ({ f: D.ROLES[r][0], vagas: lastX.vg[r].toLocaleString('pt-BR') + (lastX.vg[r] === 1 ? ' vaga' : ' vagas'), custoVaga: this.money0(lastCC.vc[r]) + ' por vaga', v: this.money0(lastX.eqBy[r]) })),
        hasDir: ca.dirs.length > 0, dir: ca.dirs.map((d) => ({ l: d[2], v: this.money0(d[1]) })) };
    }

    // RECEITA
    const MRR_START = { 7: 91900, 8: 92100, 9: 93800 };
    const MOVS = { 7: [['Novo', 'Pão de Mel Confeitaria', 3500, 'Contrato de Social Media'], ['Churn', 'Studio Fitness Max', -3300, 'Mudou de agência']], 8: [['Expansão', 'Solar Energia ES', 1200, 'Upsell de Tráfego pago'], ['Expansão', 'Autoescola Rota', 500, 'Aumento da gestão de verba']], 9: [['Novo', 'Verde Vale', 3800, 'Negócio ganho em 15/09'], ['Expansão', 'Mar Azul Pousada', 700, 'Inclusão de Tráfego pago'], ['Expansão', 'APTO', 500, 'Upsell de Tráfego pago'], ['Contração', 'Café Aroma', -300, 'Redução de escopo'], ['Churn', 'Studio Yoga Leve', -900, 'Corte de orçamento'], ['Pausa', 'Floricultura Jardim', -1200, 'Pausa até 01/11']] };
    const mv = []; months.forEach((m) => MOVS[m].forEach((x) => mv.push(x)));
    const sumT = (t) => mv.filter((x) => x[0] === t).reduce((a, x) => a + x[2], 0);
    const mStart = MRR_START[months[0]]; const mEnd = mStart + mv.reduce((a, x) => a + x[2], 0);
    const ponteMrr = wf([{ kind: 'start', v: mStart, label: 'Início' }, { kind: 'delta', v: sumT('Novo'), label: 'Novos' }, { kind: 'delta', v: sumT('Expansão'), label: 'Expansão' }, { kind: 'delta', v: sumT('Contração'), label: 'Contração' }, { kind: 'delta', v: sumT('Churn'), label: 'Churn' }, { kind: 'delta', v: sumT('Pausa'), label: 'Pausas' }, { kind: 'end', label: 'Fim' }], 250).map((b, j) => j === 5 && b.bg !== accent ? Object.assign(b, { bg: '#8F93A0', valColor: '#A6A9B1' }) : b);
    const tone = { 'Novo': ['#6FD3A2', 'rgba(111,211,162,0.13)'], 'Expansão': ['#6FD3A2', 'rgba(111,211,162,0.13)'], 'Contração': ['#EDB866', 'rgba(237,184,102,0.14)'], 'Churn': ['#F08A84', 'rgba(240,138,132,0.14)'], 'Pausa': ['#A6A9B1', 'rgba(166,169,177,0.14)'] };
    const movs = mv.map((x) => ({ tipo: x[0], cli: x[1], motivo: x[3], v: (x[2] >= 0 ? '+' : '−') + this.money0(Math.abs(x[2])), fg: tone[x[0]][0], bg: tone[x[0]][1], open: nav('Abriria a recorrência e o histórico de versões') }));
    const cliMrr = D.clients.filter((c) => c.fee[months[months.length - 1]]).length;
    const recT = G.rb; const recR = L.mens; const churn = -sumT('Churn');
    const concRows = clis.slice().sort((a, b) => b.rec - a.rec);
    const top3 = concRows.slice(0, 3).reduce((a, c) => a + c.rec, 0);
    const rk = [{ label: 'MRR', v: this.money0(mEnd), sub: (mEnd - mStart >= 0 ? '+' : '−') + this.money0(Math.abs(mEnd - mStart)) + ' no período', color: '#EEEEF0' }, { label: 'Receita do período', v: this.money0(recT), sub: this.pct(recR, recT) + ' recorrente', color: '#EEEEF0' }, { label: 'Ticket médio', v: this.money0(mEnd / cliMrr), sub: cliMrr + ' clientes com MRR', color: '#EEEEF0' }, { label: 'Churn de MRR', v: this.pct(churn, mStart), sub: this.money0(churn) + ' perdidos', color: churn / mStart > 0.02 ? '#F08A84' : '#EEEEF0' }, { label: 'Concentração top 3', v: this.pct(top3, totRec), sub: 'da receita do período', color: '#EEEEF0' }, { label: 'Clientes ativos', v: String(cliMrr), sub: 'com recorrência', color: '#EEEEF0' }];
    let acum = 0; const conc = { rows: concRows.slice(0, 8).map((c) => { acum += c.rec; const p = c.rec / totRec; return { nome: c.c.nome, w: (c.rec / concRows[0].rec * 100).toFixed(0) + '%', bg: p > 0.15 ? '#F08A84' : accent, pct: this.pct(c.rec, totRec), acum: this.pct(acum, totRec) }; }) };
    const maxC = concRows[0]; conc.note = maxC.rec / totRec > 0.15 ? maxC.c.nome + ' passa de 15% da receita. Perdê-lo reduziria a margem em ' + this.money0(maxC.mg) + '.' : 'Nenhum cliente acima de 15%. O maior é ' + maxC.c.nome + ', com ' + this.pct(maxC.rec, totRec) + '.'; conc.noteColor = maxC.rec / totRec > 0.15 ? '#EDB866' : '#A6A9B1';
    const Lp = s.comp === 'ant' ? Lc : Lc; const saPrev = { 'Social Media': 0.5, 'Tráfego pago': 0.27, 'Audiovisual': 0.17, 'Projetos e consultoria': 0.06 };
    const recSrv = SRV.map((n) => { const a = sa[n]; const prev = (Lc.mens + Lc.pont) * saPrev[n]; const d = (a.rec - prev) / prev; return { nome: n, rec: this.num0(a.recR), pon: this.num0(a.recP), tot: this.num0(a.rec), pct: this.pct(a.rec, totRec), d: (d >= 0 ? '+' : '−') + Math.abs(Math.round(d * 100)) + '%', dColor: d >= 0 ? '#6FD3A2' : '#F08A84' }; });
    const evoModos = [['tipo', 'Recorrente e pontual'], ['srv', 'Por serviço']].map(([k, label]) => ({ label, on: s.evoModo === k, bg: s.evoModo === k ? '#2C2F36' : 'transparent', fg: s.evoModo === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ evoModo: k }) }));
    const EH = 220; const eMax = 130000; const selIdx = months.map((m) => m + 2);
    const srvCols = { 'Social Media': accent, 'Tráfego pago': '#7FC8F8', 'Audiovisual': '#EDB866', 'Projetos e consultoria': '#6FD3A2' };
    const evo = { cols: idxs12.map((i) => { const rbI = D.RB12[i], mrrI = D.MRR12[i]; const segs = s.evoModo === 'tipo' ? [{ h: (mrrI / eMax * EH).toFixed(1), bg: accent }, { h: ((rbI - mrrI) / eMax * EH).toFixed(1), bg: '#7FC8F8' }] : SRV.map((n) => ({ h: (rbI * saPrev[n] * (1 + ((i % 3) - 1) * 0.04) / eMax * EH).toFixed(1), bg: srvCols[n] })); return { m: D.MLAB[i], segs, tip: D.MLAB[i] + ': receita ' + this.money0(rbI) + ', MRR ' + this.money0(mrrI), colBg: selIdx.includes(i) ? 'rgba(169,155,255,0.07)' : 'transparent', lblColor: selIdx.includes(i) ? '#EEEEF0' : '#A6A9B1' }; }),
      line: 'M ' + idxs12.map((i) => ((i + 0.5) * (1080 + 14) / 12 - 7).toFixed(1) + ' ' + (230 - D.MRR12[i] / eMax * EH).toFixed(1)).join(' L '),
      leg: s.evoModo === 'tipo' ? [{ t: 'Recorrente', bg: accent }, { t: 'Pontual', bg: '#7FC8F8' }] : SRV.map((n) => ({ t: n, bg: srvCols[n] })) };

    const ajustes = [{ linha: 'Softwares', v: '+R$ 240', t: 'Assinatura do Figma reclassificada de Transporte, por Iago Lima em 03/09' }, { linha: 'Freelancers e adicionais', v: '+R$ 950', t: 'NF de Pedro Alves com competência corrigida para agosto, por Iago Lima em 05/09' }];

    return {
      accent, exportar: nav('Geraria o PDF de uma página: indicadores, DRE resumida, 5 clientes mais e menos rentáveis e ponte do MRR'),
      grans, perLabel, perPrev: () => this.setState({ mes: Math.max(7, s.mes - 1), cli: null }), perNext: () => this.setState({ mes: Math.min(9, s.mes + 1), cli: null }),
      comp: s.comp, onComp: (e) => this.setState({ comp: e.target.value }), selo, seloOpen: s.seloOpen && s.gran === 'mes' && s.mes === 8, toggleSelo: () => this.setState({ seloOpen: !s.seloOpen }), ajustes,
      kpis, tabs, tabDre: s.tab === 'dre', tabRent: s.tab === 'rent', tabRec: s.tab === 'rec',
      cem, dre, modos, varc, fora, ponteCx,
      lancOpen: !!s.lanc, lanc, closeLanc: () => this.setState({ lanc: null }),
      dims, dimCli: s.dim === 'cli', dimSrv: s.dim === 'srv', dimProj: s.dim === 'proj', dimSq: s.dim === 'sq', comoOpen: s.como, toggleComo: () => this.setState({ como: !s.como }),
      prova, hasAlertas: alertas.length > 0, alertas, mx, clearHovCli: () => this.setState({ hovCli: null }), cliRows, cliFoot, srv, projRows, squads, funcoes,
      cliOpen: !!ca, cf, closeCli: () => this.setState({ cli: null }), simFee: s.simFee || (ca ? Math.round(ca.c.fee[months[months.length - 1]] || ca.rec / ca.n).toLocaleString('pt-BR') : ''), onSimFee: (e) => this.setState({ simFee: e.target.value }), ajustarAloc: nav('Abriria a alocação do cliente em Pagamentos, Folha'),
      rk, ponteMrr, ponteMrrSub: 'De ' + this.money0(mStart) + ' para ' + this.money0(mEnd) + ' em ' + perLabel.toLowerCase(), movs, evoModos, evo, conc, recSrv,
      hasToast: !!s.toast, toast: s.toast || ''
    };
  }
}
