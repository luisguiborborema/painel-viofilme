/*
MOCKUP — Planejamento (Viofilme ERP) · FONTE LEGÍVEL · ARQUIVO 3 de 3
Lógica do mockup: estado, DADOS DE EXEMPLO (fictícios, mas coerentes entre si; use como exemplo de cálculo),
derivações e handlers. Os bindings {{ ... }} de mockup_planejamento_1_pagina.html e mockup_planejamento_2_paineis.html vêm daqui
(principalmente de renderVals()). DCLogic é a classe base do runtime do Claude Design (setState, props).
Props do componente: {"accent":{"editor":"color","default":"#A99BFF","options":["#A99BFF","#F2A97E","#9ADFB5","#E8D27A"]},"$preview":{"width":1440,"height":1500}}
*/
class Component extends DCLogic {
  constructor(...a) {
    super(...a);
    this.state = {
      tab: 'orc', per: 'mes', mes: 8, reviewed: false, revOpen: false, revStep: 1,
      rev: { var: { com: '', cls: null }, com: { com: '', cls: null }, soft: { com: '', cls: null } },
      togPont: true, togNovos: false, togProv: true,
      events: [
        { id: 1, tipo: 'Cliente novo', desc: 'Verde Vale fechou contrato', mes: 9, valor: 3800, conf: 'Confirmado', resolvido: true, rec: true },
        { id: 2, tipo: 'Mudança de fee', desc: 'Floricultura Jardim retoma a recorrência', mes: 11, valor: 1200, conf: 'Confirmado', rec: true },
        { id: 3, tipo: 'Cliente novo', desc: 'Rede Farma Mais, segunda unidade', mes: 11, valor: 4000, conf: 'Provável', rec: true },
        { id: 4, tipo: 'Cliente vai sair', desc: 'BNEX avisou que encerra o contrato', mes: 12, valor: -3300, conf: 'Confirmado', rec: true },
        { id: 5, tipo: 'Gasto pontual', desc: 'Confraternização de fim de ano da equipe', mes: 12, valor: -6000, conf: 'Confirmado', rec: false }
      ],
      evf: { tipo: 'Cliente novo', desc: '', mes: '11', valor: '', conf: 'Provável' },
      q: null, qf: { funcao: 'SM', rem: '3.500', mes: '1', cli: '0', metaTipo: 'mrr', meta: '120.000', dist: '30.000', distMes: '2' },
      scen: [
        { id: 'c', nome: 'Conservador', tag: 'se der errado', color: '#F08A84', lev: { novos: 0, churn: 4, pont: -30, fixos: 0, ticket: 4380 }, auto: false },
        { id: 'b', nome: 'Base', tag: 'se continuar assim', color: '#A99BFF', lev: { novos: 1.2, churn: 2.5, pont: 0, fixos: 0, ticket: 4380 }, auto: false },
        { id: 'a', nome: 'Agressivo', tag: 'se der certo', color: '#6FD3A2', lev: { novos: 2, churn: 1.8, pont: 20, fixos: 5, ticket: 4380 }, auto: true }
      ],
      wz: null, budget27: false, toast: null
    };
  }
  money0(n) { return (n < 0 ? '−R$ ' : 'R$ ') + Math.abs(Math.round(n)).toLocaleString('pt-BR'); }
  num0(n) { const r = Math.round(n); return r === 0 ? '—' : (r < 0 ? '−' : '') + Math.abs(r).toLocaleString('pt-BR'); }
  mil(n, d) { return (n < 0 ? '−' : '') + (Math.abs(n) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: d === undefined ? 1 : d, maximumFractionDigits: d === undefined ? 1 : d }); }
  milR(n) { return (n < 0 ? '−' : '') + 'R$ ' + (Math.abs(n) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(n) >= 1e6 ? 0 : 1 }) + (Math.abs(n) >= 1e6 ? '' : ' mil'); }
  mi(n) { return Math.abs(n) >= 1e6 ? 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : this.milR(n); }
  pct(n, d, dig) { return d ? (n / d * 100).toLocaleString('pt-BR', { maximumFractionDigits: dig === undefined ? 1 : dig }) + '%' : '—'; }
  parse(s) { const v = parseFloat(String(s === undefined ? '' : s).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(v) ? 0 : v; }
  say(m) { this.setState({ toast: m }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 3800); }
  componentWillUnmount() { clearTimeout(this._t); }
  KEYS() { return ['rec', 'pon', 'imp', 'eq', 'var', 'pro', 'adm', 'com', 'estr', 'soft', 'transp', 'fin']; }
  realMonth(m) {
    const RB = [90800, 93500, 95000, 98500, 104200, 101800]; const MRR = [77000, 79800, 82400, 84900, 88600, 91900];
    if (m <= 6) { const i = m - 1; const rb = RB[i]; return { rec: MRR[i], pon: rb - MRR[i], imp: rb * 0.06, eq: [25800, 25800, 27000, 27000, 28800, 28800][i], var: 5900 * rb / 114300, pro: 12210, adm: 5000, com: [3000, 3200, 3400, 3000, 3200, 3400][i], estr: 6500, soft: 7100 + i * 100, transp: 500, fin: -100 }; }
    const R = { 7: [92100, 17500, 6576, 28800, 6400, 12210, 5000, 3300, 6710, 7600, 590, -110], 8: [93800, 20500, 6858, 28800, 6420, 12210, 5000, 3700, 6710, 8000, 520, -90], 9: [96400, 22600, 7140, 28800, 11090, 12210, 5000, 4150, 6710, 9440, 480, -25] }[m];
    const o = {}; this.KEYS().forEach((k, j) => o[k] = R[j]); return o;
  }
  budgetMonth(m) {
    let mrr = 76100; for (let i = 1; i <= m; i++) mrr = mrr * 0.988 + 3800;
    const pon = 15000; const rb = mrr + pon;
    return { rec: mrr, pon, imp: rb * 0.06, eq: m <= 3 ? 25800 : 28800, var: rb * 0.05, pro: 12210, adm: 5000, com: 3000, estr: 6710, soft: m < 9 ? 7000 : 8000, transp: 400, fin: -100 };
  }
  res(L) { return L.rec + L.pon - L.imp - L.eq - L.var - L.pro - L.adm - L.com - L.estr - L.soft - L.transp + L.fin; }
  projMonth(m) {
    const s = this.state; if (m <= 9) return this.realMonth(m);
    let rec = 96400; let extraCost = 0; let eqAdd = 0; let softAdd = 0;
    s.events.forEach((e) => { if (e.resolvido) return; if (!s.togProv && e.conf === 'Provável') return; if (e.mes > m) return; if (e.rec) rec += e.valor; else if (e.tipo === 'Contratação') eqAdd += -Math.abs(e.valor); else if (e.tipo === 'Receita pontual') { if (e.mes === m) rec += 0; } else if (e.mes === m) extraCost += -e.valor; });
    s.events.forEach((e) => { if (!e.resolvido && e.tipo === 'Receita pontual' && e.mes === m && (s.togProv || e.conf !== 'Provável')) extraCost -= e.valor; });
    if (s.rev.soft.cls === 'perm') softAdd = 1000;
    if (s.togNovos) rec += 1.2 * 4380 * (m - 9);
    const contr = { 10: 15000, 11: 9000, 12: 0 }[m]; const pon = s.togPont ? Math.max(contr, 16600) : contr;
    const rb = rec + pon;
    return { rec, pon, imp: rb * 0.06, eq: 28800 + eqAdd * -1, var: rb * 0.068, pro: 12210, adm: 5000, com: 3700, estr: 6710 + extraCost, soft: 9440 + softAdd, transp: 500, fin: -50 };
  }
  sim12(lev, auto) {
    let mrr = 96400, clients = 22, used = 22, cap = 22, eqExtra = 0, cash = 84320, minCash = 1e12, minIdx = 0, rec = 0, res = 0, ro = 0, rl = 0, hires = [], capBreak = null; const saldo = [];
    const ML = ['out/26', 'nov/26', 'dez/26', 'jan/27', 'fev/27', 'mar/27', 'abr/27', 'mai/27', 'jun/27', 'jul/27', 'ago/27', 'set/27'];
    for (let i = 0; i < 12; i++) {
      const churned = clients * lev.churn / 100; clients = clients - churned + lev.novos; mrr = mrr * (1 - lev.churn / 100) + lev.novos * lev.ticket; used = used - churned + lev.novos;
      if (used > cap + 0.01) { if (auto) { cap += 11; eqExtra += 3500; hires.push(ML[i]); } else if (!capBreak) capBreak = ML[i]; }
      const pon = 16600 * (1 + lev.pont / 100); const rb = mrr + pon; const imp = rb * 0.06; const vari = rb * 0.068; const eq = 28800 + eqExtra; const fixos = (12210 + 5000 + 3700 + 6710 + 9440 + 500) * (1 + lev.fixos / 100);
      const r = rb - imp - vari - eq - fixos - 50; rec += rb; res += r; rl += rb - imp;
      const out = (i === 2 || i === 5 || i === 8 ? 90000 : 0) + (i === 1 ? 18900 : 0) + 5000;
      cash += r * 0.95 - out; saldo.push(cash); if (cash < minCash) { minCash = cash; minIdx = i; }
    }
    return { rec, res, rl, mrr, minCash, minMes: ML[minIdx], hires, capBreak, saldo, ML };
  }
  renderVals() {
    const s = this.state; const accent = this.props.accent ?? '#A99BFF'; const nav = (t) => () => this.say(t);
    const MN = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const MNF = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const K = this.KEYS();
    const B = []; const P = []; for (let m = 1; m <= 12; m++) { B[m] = this.budgetMonth(m); P[m] = this.projMonth(m); }
    const sumL = (arr) => { const o = {}; K.forEach((k) => o[k] = arr.reduce((a, L) => a + L[k], 0)); return o; };
    const Bano = sumL(B.slice(1)); const Pano = sumL(P.slice(1));
    const rl = (L) => L.rec + L.pon - L.imp; const ro = (L) => this.res(L) - L.fin;
    const realAcum = sumL(P.slice(1, 9));

    // METAS
    const mrrMetaDez = B[12].rec; const mrrProjDez = P[12].rec;
    const metaCard = (label, meta, atual, ritmo, ok, w) => ({ label, meta, atual, ritmo, color: ok === 2 ? '#6FD3A2' : ok === 1 ? '#EDB866' : '#F08A84', border: ok === 0 ? 'rgba(240,138,132,0.35)' : '#2C2F36', w });
    const lvl = (proj, meta, inv) => { const r = inv ? meta / proj : proj / meta; return r >= 0.98 ? 2 : r >= 0.92 ? 1 : 0; };
    const rbAno = Bano.rec + Bano.pon; const rbProj = Pano.rec + Pano.pon;
    const moB = ro(Bano) / rl(Bano), moP = ro(Pano) / rl(Pano), moA = ro(realAcum) / rl(realAcum);
    const metas = [
      metaCard('MRR em dezembro', this.money0(mrrMetaDez), 'Hoje ' + this.money0(96400) + ' (' + this.pct(96400, mrrMetaDez, 0) + ' da meta)', 'No ritmo: ' + this.money0(mrrProjDez), lvl(mrrProjDez, mrrMetaDez), Math.min(100, 96400 / mrrMetaDez * 100).toFixed(0) + '%'),
      metaCard('Receita do ano', this.mi(rbAno), 'Realizado até agosto: ' + this.mi(realAcum.rec + realAcum.pon), 'No ritmo: ' + this.mi(rbProj), lvl(rbProj, rbAno), Math.min(100, (realAcum.rec + realAcum.pon) / rbAno * 100).toFixed(0) + '%'),
      metaCard('Margem operacional', this.pct(moB, 1, 1), 'Acumulada: ' + this.pct(moA, 1, 1), 'No ritmo: ' + this.pct(moP, 1, 1), moP >= moB - 0.005 ? 2 : moP >= moB - 0.02 ? 1 : 0, Math.min(100, moA / moB * 100).toFixed(0) + '%'),
      metaCard('Resultado do ano', this.milR(this.res(Bano)), 'Acumulado: ' + this.milR(this.res(realAcum)), 'No ritmo: ' + this.milR(this.res(Pano)), lvl(this.res(Pano), this.res(Bano)), Math.min(100, this.res(realAcum) / this.res(Bano) * 100).toFixed(0) + '%'),
      metaCard('Caixa mínimo', 'Acima de R$ 30 mil', 'Menor saldo projetado: R$ 40 mil em 05/10', 'Dentro da meta', 2, '100%')
    ];

    // ORÇADO × REALIZADO
    const LINES = [['rec', 'Receita recorrente', 1], ['pon', 'Receita pontual', 1], ['imp', 'Impostos', -1], ['eq', 'Equipe de entrega', -1], ['var', 'Custos variáveis de produção', -1], ['pro', 'Pró-labore e encargos', -1], ['adm', 'Equipe administrativa', -1], ['com', 'Comercial e comissões', -1], ['estr', 'Estrutura e contabilidade', -1], ['soft', 'Softwares', -1], ['transp', 'Transporte e alimentação', -1], ['fin', 'Resultado financeiro', 1]];
    const months = s.per === 'mes' ? [s.mes] : Array.from({ length: s.mes }, (_, i) => i + 1);
    const Lo = sumL(months.map((m) => B[m])); const Lr = sumL(months.map((m) => P[m]));
    const COM = { 8: { var: s.rev.var.com, com: s.rev.com.com, soft: s.rev.soft.com }, 9: { soft: 'Frame.io e Envato novos no cartão; ver revisão de setembro' } };
    const farolOf = (d, base, sign) => { const unf = sign === 1 ? d < 0 : d > 0; const p = base ? Math.abs(d / base) : 0; if (!unf || p <= 0.1) return ['#6FD3A2', 'Dentro da tolerância ou a favor']; if (Math.abs(d) <= 500) return ['#EDB866', 'Fora de 10%, até R$ 500']; return ['#F08A84', 'Fora de 10% e acima de R$ 500']; };
    const oxr = LINES.map(([k, l, sign]) => { const o = Lo[k], r = Lr[k]; const d = r - o; const f = farolOf(d, Math.abs(o), sign); const com = s.per === 'mes' && COM[s.mes] && COM[s.mes][k] !== undefined ? COM[s.mes][k] : ''; const pend = f[0] === '#F08A84' && !com && s.per === 'mes' && s.mes === 8 && !s.reviewed;
      return { label: l, orc: this.num0(sign === -1 ? -o : o), real: this.num0(sign === -1 ? -r : r), d: this.num0(sign === -1 ? -d : d), dp: o ? ((d >= 0 ? '+' : '−') + this.pct(Math.abs(d), Math.abs(o), 0)) : '—', dColor: f[0] === '#6FD3A2' ? '#A6A9B1' : f[0], farol: f[0], farolTxt: f[1], com: pend ? 'Comentar na revisão do mês' : (com || ''), comColor: pend ? '#EDB866' : '#C9CBD1', fw: '400', lblColor: '#C9CBD1', bg: 'transparent', line: '#25282D', open: nav('Abriria os lançamentos de ' + l.toLowerCase() + ' (mesmo painel de Resultados)') }; });
    const ro_ = this.res(Lo), rr_ = this.res(Lr); const fR = farolOf(rr_ - ro_, Math.abs(ro_), 1);
    oxr.push({ label: 'Resultado', orc: this.num0(ro_), real: this.num0(rr_), d: this.num0(rr_ - ro_), dp: (rr_ - ro_ >= 0 ? '+' : '−') + this.pct(Math.abs(rr_ - ro_), Math.abs(ro_), 0), dColor: rr_ >= ro_ ? '#6FD3A2' : fR[0], farol: fR[0], farolTxt: fR[1], com: '', comColor: '#C9CBD1', fw: '700', lblColor: '#EEEEF0', bg: '#1A1C20', line: '#2A2D33', open: () => {} });
    const pers = [['mes', 'Mês'], ['acum', 'Acumulado do ano']].map(([k, label]) => ({ label, on: s.per === k, bg: s.per === k ? '#2C2F36' : 'transparent', fg: s.per === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ per: k }) }));
    const premissas = [
      { grupo: 'Receita recorrente', itens: [['MRR inicial', 'R$ 76.100', 'Das recorrências em dez/25'], ['Novos clientes por mês', '1,0', 'Sugestão: 0,9 (média de 6 meses)'], ['Ticket dos novos', 'R$ 3.800', 'Sugestão: ticket médio de dez/25'], ['Churn mensal', '1,2%', 'Sugestão: média de 12 meses']] },
      { grupo: 'Receita pontual', itens: [['Meta mensal', 'R$ 15.000', 'Sugestão: R$ 14.100 (média de 12 meses)'], ['Sazonalidade', 'Não', 'Sem histórico suficiente em 2025']] },
      { grupo: 'Equipe', itens: [['Folha de janeiro', 'R$ 25.800', 'Da folha de dez/25'], ['Contratação: videomaker', 'abr, R$ 3.000', 'Adicionada por Iago Lima'], ['Reajuste de remuneração', 'Nenhum', 'Revisar em 2027']] },
      { grupo: 'Custos fixos', itens: [['Estrutura e contabilidade', 'R$ 6.710', 'Manter (recorrências)'], ['Softwares', 'R$ 7.000, R$ 8.000 a partir de set', 'Nova ferramenta de gestão em setembro'], ['Pró-labore, adm. e comercial', 'R$ 20.210', 'Manter'], ['Transporte e alimentação', 'R$ 400', 'Sugestão: R$ 520 (média)']] },
      { grupo: 'Variáveis e impostos', itens: [['Impostos', '6% da receita', 'Alíquota efetiva de 2025'], ['Custos variáveis de produção', '5% da receita', 'Sugestão: 5,6% (média de 12 meses)']] },
      { grupo: 'Investimentos e distribuições', itens: [['Câmera de cinema', 'nov, R$ 18.900', 'Planejado'], ['Distribuição de lucros', 'jun R$ 90 mil, set R$ 60 mil, dez R$ 90 mil', 'Trimestral']] }
    ].map((g) => ({ grupo: g.grupo, itens: g.itens.map((i) => ({ l: i[0], v: i[1], orig: i[2], edit: nav('Editar abriria a premissa com o efeito no ano antes de salvar. Em versão aprovada, a mudança cria uma revisão') })) }));

    // ROTINA
    const rot = s.reviewed ? { t: 'Revisão de agosto concluída hoje por Iago Lima', sub: 'Próxima: revisão de setembro, depois do fechamento. Em novembro: montar o orçamento de 2027.', border: '#2C2F36', bg: '#1D1F24', iconBg: 'rgba(111,211,162,0.14)', iconFg: '#6FD3A2', hasCta: false } : { t: 'Revisão de agosto: 3 desvios para comentar', sub: 'Leva uns 15 minutos. Agosto foi fechado em 10/09.', border: 'rgba(169,155,255,0.35)', bg: 'rgba(169,155,255,0.07)', iconBg: 'rgba(169,155,255,0.18)', iconFg: '#C4B9FF', hasCta: true };

    // REVISÃO
    const DV = [['var', 'Custos variáveis de produção', 5715, 6420, [['Freelancers de captação e drone, Solar Energia', 'R$ 2.800'], ['Marina Costa, edição, Sabor do Mar', 'R$ 1.500']]], ['com', 'Comercial e comissões', 3000, 3700, [['Comissões de 2 negócios ganhos em julho', 'R$ 900'], ['Fixo do comercial', 'R$ 2.800']]], ['soft', 'Softwares', 7000, 8000, [['Figma, plano profissional (novo)', 'R$ 245'], ['Reajuste do Adobe e novas licenças', 'R$ 755']]]];
    const desvios = DV.map(([k, l, o, r, exp]) => { const st = s.rev[k]; const setR = (p) => { const rv = Object.assign({}, s.rev); rv[k] = Object.assign({}, st, p); this.setState({ rev: rv }); }; return { l, orc: this.money0(o), real: this.money0(r), d: '+' + this.money0(r - o) + ' (+' + this.pct(r - o, o, 0) + ')', exp: exp.map((e) => ({ l: e[0], v: e[1] })), com: st.com, onCom: (e) => setR({ com: e.target.value }), opts: [['pont', 'Pontual', 'Não muda o plano'], ['perm', 'Permanente', 'Atualiza a projeção do ano']].map(([c, t, sub]) => ({ t, s: sub, on: st.cls === c, border: st.cls === c ? accent : '#33363E', bg: st.cls === c ? 'rgba(169,155,255,0.08)' : 'transparent', pick: () => setR({ cls: c }) })) }; });
    const revSteps = [['Desvios', 1], ['Metas no ritmo', 2], ['Concluir', 3]].map(([t, n]) => ({ t, bar: s.revStep >= n ? accent : '#33363E', fg: s.revStep >= n ? '#EEEEF0' : '#A6A9B1' }));
    const nCls = DV.filter(([k]) => s.rev[k].cls).length; const nPerm = DV.filter(([k]) => s.rev[k].cls === 'perm');
    const revResumo = [{ t: DV.filter(([k]) => s.rev[k].com).length + ' de 3 desvios comentados' }, { t: nPerm.length ? nPerm.length + ' classificado(s) como permanente: ' + nPerm.map((d) => d[1].toLowerCase()).join(', ') + '. A projeção do ano foi atualizada.' : 'Nenhum desvio permanente: a projeção não muda.' }, { t: 'Metas: ' + metas.filter((m) => m.color === '#F08A84').length + ' em risco, ' + metas.filter((m) => m.color === '#EDB866').length + ' em atenção.' }];

    // PROJEÇÃO
    const togs = [['togPont', 'Incluir pontual pela média', false], ['togNovos', 'Incluir novos clientes pelo ritmo atual', false], ['togProv', 'Incluir eventos prováveis', false], ['pipe', 'Incluir pipeline (quando o Comercial estiver integrado)', true]].map(([k, label, dis]) => { const on = !dis && s[k]; return { label, on, dis, fg: dis ? '#6E727B' : '#EEEEF0', cursor: dis ? 'not-allowed' : 'pointer', track: on ? accent : '#454852', knob: on ? '14px' : '2px', toggle: dis ? () => {} : () => { const o = {}; o[k] = !s[k]; this.setState(o); } }; });
    const cxDez = 84320 + 8000 + [10, 11, 12].reduce((a, m) => a + this.res(P[m]) * 0.9, 0) - 18900 - 90000 - 15000;
    const dP = (p, o, inv) => { const d = (p - o) / Math.abs(o); return { t: (d >= 0 ? '+' : '−') + Math.abs(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%', c: (inv ? d <= 0 : d >= 0) ? '#6FD3A2' : Math.abs(d) < 0.03 ? '#EDB866' : '#F08A84' }; };
    const pd1 = dP(rbProj, rbAno), pd2 = dP(this.res(Pano), this.res(Bano)), pd3 = dP(mrrProjDez, mrrMetaDez), pd4 = dP(cxDez, 95000);
    const pouso = [{ label: 'Receita do ano', v: this.mi(rbProj), orc: this.mi(rbAno), d: pd1.t, dColor: pd1.c }, { label: 'Resultado do ano', v: this.milR(this.res(Pano)), orc: this.milR(this.res(Bano)), d: pd2.t, dColor: pd2.c }, { label: 'MRR em dezembro', v: this.money0(mrrProjDez), orc: this.money0(mrrMetaDez), d: pd3.t, dColor: pd3.c }, { label: 'Caixa em dezembro', v: this.milR(cxDez), orc: this.milR(95000), d: pd4.t, dColor: pd4.c }];
    const resM = []; const resB = []; for (let m = 1; m <= 12; m++) { resM.push(this.res(P[m])); resB.push(this.res(B[m])); }
    const mxR = Math.max(...resM, ...resB) * 1.15;
    const colW = (1080 - 11 * 18) / 12;
    const pch = { cols: resM.map((v, i) => { const m = i + 1; const proj = m >= 10; const mixed = m === 9; return { m: MN[m], h: Math.max(2, v / mxR * 196).toFixed(1), bg: proj ? 'rgba(169,155,255,0.12)' : mixed ? 'repeating-linear-gradient(135deg, ' + accent + ' 0 5px, rgba(169,155,255,0.25) 5px 9px)' : accent, border: proj ? '1.5px dashed ' + accent : 'none', tip: MNF[m] + ': resultado ' + this.money0(v) + ' · orçado ' + this.money0(resB[i]) }; }),
      orcLine: 'M ' + resB.map((v, i) => ((i * (colW + 18)) + colW / 2).toFixed(1) + ' ' + (200 - v / mxR * 196).toFixed(1)).join(' L ') };
    const origemTxt = (k, m) => { if (m <= 8) return 'Realizado em ' + MNF[m].toLowerCase(); if (m === 9) return 'Setembro em curso: realizado + previsto'; if (k === 'rec') return 'MRR vigente de R$ 96.400 + eventos previstos' + (s.togNovos ? ' + ritmo de novos clientes' : ''); if (k === 'pon') return s.togPont ? 'Parcelas contratadas ou média de 6 meses (R$ 16.600), o que for maior' : 'Só parcelas já contratadas'; return 'Recorrências de despesa, folha e % médio da receita'; };
    const prow = (label, fn, fnB, fw, bg, inv) => { const cells = []; let ano = 0; for (let m = 1; m <= 12; m++) { const v = fn(P[m]); ano += v; cells.push({ v: this.mil(v), color: m >= 10 ? '#C9CBD1' : '#EEEEF0', fs: m >= 10 ? 'italic' : 'normal', bg: m >= 10 ? 'rgba(238,238,240,0.03)' : m === 9 ? 'rgba(169,155,255,0.06)' : 'transparent', open: nav(label + ', ' + MNF[m].toLowerCase() + ': ' + origemTxt(label === 'Receita recorrente' ? 'rec' : label === 'Receita pontual' ? 'pon' : 'x', m)) }); } const orc = B.slice(1).reduce((a, L) => a + fnB(L), 0); const d = (ano - orc) / Math.abs(orc); return { label, cells, ano: this.mil(ano, 0), orc: this.mil(orc, 0), d: (d >= 0 ? '+' : '−') + Math.abs(Math.round(d * 100)) + '%', dColor: (inv ? d <= 0 : d >= 0) ? '#6FD3A2' : '#F08A84', fw, bg }; };
    const custos = (L) => L.imp + L.eq + L.var + L.pro + L.adm + L.com + L.estr + L.soft + L.transp - L.fin;
    const ptab = { head: MN.slice(1).map((m, i) => ({ m, bg: i + 1 >= 10 ? 'rgba(238,238,240,0.03)' : i + 1 === 9 ? 'rgba(169,155,255,0.06)' : 'transparent', fg: i + 1 >= 10 ? '#8F93A0' : '#A6A9B1' })), rows: [prow('Receita recorrente', (L) => L.rec, (L) => L.rec, '400', 'transparent'), prow('Receita pontual', (L) => L.pon, (L) => L.pon, '400', 'transparent'), prow('Custos e despesas', (L) => -custos(L), (L) => -custos(L), '400', 'transparent', false), prow('Resultado', (L) => this.res(L), (L) => this.res(L), '700', '#1A1C20')] };
    const tipoTone = { 'Cliente novo': ['#6FD3A2', 'rgba(111,211,162,0.13)'], 'Cliente vai sair': ['#F08A84', 'rgba(240,138,132,0.14)'], 'Mudança de fee': ['#86B4F7', 'rgba(134,180,247,0.13)'], 'Contratação': ['#EDB866', 'rgba(237,184,102,0.14)'], 'Gasto pontual': ['#EDB866', 'rgba(237,184,102,0.14)'], 'Receita pontual': ['#6FD3A2', 'rgba(111,211,162,0.13)'] };
    const evs = s.events.map((e) => ({ tipo: e.tipo, tFg: tipoTone[e.tipo][0], tBg: tipoTone[e.tipo][1], desc: e.desc, hasNota: !!e.resolvido, nota: e.resolvido ? 'Já aconteceu: recorrência criada em Recebimentos em 15/09' : '', mes: 'a partir de ' + MN[e.mes], v: (e.valor >= 0 ? '+' : '−') + this.money0(Math.abs(e.valor)) + (e.rec ? '/mês' : ''), vColor: e.valor >= 0 ? '#6FD3A2' : '#F08A84', conf: e.conf, cFg: e.conf === 'Confirmado' ? '#6FD3A2' : '#EDB866', resolvido: !!e.resolvido, aberto: !e.resolvido, border: e.resolvido ? 'rgba(111,211,162,0.35)' : '#2C2F36', bg: e.resolvido ? 'rgba(111,211,162,0.05)' : '#191B1F', remover: () => { this.setState({ events: s.events.filter((x) => x.id !== e.id) }); this.say(e.resolvido ? 'Evento removido: o registro real já está na projeção' : 'Evento excluído da projeção'); } }));
    const setEvf = (p) => this.setState({ evf: Object.assign({}, s.evf, p) });
    const addEv = () => { const v = this.parse(s.evf.valor); if (!v || !s.evf.desc) { this.say('Preencha descrição e valor'); return; } const neg = ['Cliente vai sair', 'Contratação', 'Gasto pontual'].includes(s.evf.tipo); this.setState({ events: s.events.concat([{ id: Date.now(), tipo: s.evf.tipo, desc: s.evf.desc, mes: parseInt(s.evf.mes, 10), valor: neg ? -v : v, conf: s.evf.conf, rec: ['Cliente vai sair', 'Cliente novo', 'Mudança de fee'].includes(s.evf.tipo) }]), evf: { tipo: 'Cliente novo', desc: '', mes: '11', valor: '', conf: 'Provável' } }); this.say('Evento adicionado. A projeção foi recalculada'); };

    // CENÁRIOS
    const perguntas = [['contratar', 'Posso contratar alguém?', 'Custo, efeito no caixa e quantos clientes pagam a pessoa.', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6'], ['perder', 'E se perdermos um cliente?', 'O que sai da receita, da margem e o que fica de ociosidade.', 'M3 12h18M12 3v18'], ['vender', 'Quanto preciso vender?', 'Da meta para novos clientes por mês e capacidade.', 'M3 17l6-6 4 4 8-8M14 7h7v7'], ['distribuir', 'Posso distribuir lucros?', 'O menor saldo depois da distribuição e o máximo seguro.', 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']].map(([k, t, sub, icon]) => ({ t, sub, icon, open: () => this.setState({ q: k }) }));
    const base = this.sim12(s.scen[1].lev, false);
    const cens = s.scen.map((c, idx) => { const r = this.sim12(c.lev, c.auto); const setLev = (key, val) => { const sc = s.scen.map((x) => x.id === c.id ? Object.assign({}, x, { lev: Object.assign({}, x.lev, { [key]: val }) }) : x); this.setState({ scen: sc }); };
      const levDef = [['novos', 'Novos clientes por mês', (v) => v.toLocaleString('pt-BR')], ['churn', 'Churn mensal (%)', (v) => v.toLocaleString('pt-BR')], ['ticket', 'Ticket dos novos (R$)', (v) => v.toLocaleString('pt-BR')], ['pont', 'Pontual vs. média (%)', (v) => (v > 0 ? '+' : '') + v], ['fixos', 'Custos fixos (%)', (v) => (v > 0 ? '+' : '') + v]];
      return { nome: c.nome, tag: c.tag, color: c.color, border: idx === 1 ? 'rgba(169,155,255,0.4)' : '#2C2F36',
        levs: levDef.map(([k, l, fmt]) => ({ l, v: fmt(c.lev[k]), on: (e) => setLev(k, this.parse(e.target.value)) })),
        auto: c.auto, autoTrack: c.auto ? accent : '#454852', autoKnob: c.auto ? '14px' : '2px', toggleAuto: () => this.setState({ scen: s.scen.map((x) => x.id === c.id ? Object.assign({}, x, { auto: !x.auto }) : x) }),
        res: [{ l: 'Receita em 12 meses', v: this.mi(r.rec), color: '#EEEEF0' }, { l: 'Resultado em 12 meses', v: this.milR(r.res), color: r.res < 0 ? '#F08A84' : '#EEEEF0' }, { l: 'Margem operacional', v: this.pct(r.res, r.rl, 1), color: '#EEEEF0' }, { l: 'MRR em set/27', v: this.money0(r.mrr), color: '#EEEEF0' }, { l: 'Menor saldo de caixa', v: this.milR(r.minCash) + ' em ' + r.minMes, color: r.minCash < 30000 ? '#F08A84' : '#EEEEF0' }, { l: 'Diferença para a base', v: (r.res - base.res >= 0 ? '+' : '−') + this.milR(Math.abs(r.res - base.res)), color: r.res >= base.res ? '#6FD3A2' : '#F08A84' }],
        cap: r.hires.length ? 'Contrataria social media em ' + r.hires.join(', ') + ' (R$ 3.500 cada, 11 vagas).' : r.capBreak ? 'Sem contratação: a capacidade de social media estoura em ' + r.capBreak + '.' : 'A equipe atual comporta este cenário.', capColor: r.capBreak ? '#EDB866' : '#A6A9B1',
        usar: () => { this.setState({ wz: this.wzInit(c.lev, r.hires.length), tab: 'orc' }); this.say('Assistente aberto com as alavancas de ' + c.nome.toLowerCase() + ' como premissas'); } }; });
    const all = s.scen.map((c) => this.sim12(c.lev, c.auto));
    const cvals = all.flatMap((r) => r.saldo).concat([30000, 0]); const cmx = Math.max(...cvals) * 1.08, cmn = Math.min(...cvals, 0);
    const CY = (v) => 10 + 210 * (cmx - v) / (cmx - cmn); const CX = (i) => 60 + i * (1010 / 11);
    const pathOf = (r) => r ? 'M ' + r.saldo.map((v, i) => CX(i).toFixed(1) + ' ' + CY(v).toFixed(1)).join(' L ') : '';
    const step = (cmx - cmn) / 4; const nice = step > 100000 ? 100000 : 50000; const yv = []; for (let v = Math.ceil(cmn / nice) * nice; v <= cmx; v += nice) yv.push(v);
    const cenChart = { yl: yv.map((v) => ({ top: (CY(v) - 7).toFixed(0), t: this.milR(v).replace(' mil', 'k') })), zero: CY(0).toFixed(1), res: CY(30000).toFixed(1), p0: pathOf(all[0]), p1: pathOf(all[1]), p2: pathOf(all[2]), p3: pathOf(all[3]), c0: s.scen[0].color, c1: s.scen[1].color, c2: s.scen[2].color, c3: s.scen[3] ? s.scen[3].color : 'transparent', xl: all[0].ML.map((t) => ({ t })) };
    const cenLeg = s.scen.map((c) => ({ n: c.nome, c: c.color }));

    // PERGUNTAS
    let qc = { linhas: [] }; const qf = s.qf; const setQf = (p) => this.setState({ qf: Object.assign({}, qf, p) });
    if (s.q === 'contratar') {
      const F = { SM: ['Social Media', 11, 100], TR: ['Tráfego pago', 16, 94], DS: ['Design', 18, 103], AV: ['Audiovisual', 7, 82] }[qf.funcao]; const rem = this.parse(qf.rem); const ini = parseInt(qf.mes, 10); const meses = 12 - ini;
      const r2 = this.sim12(s.scen[1].lev, false); const minAfter = Math.min(...r2.saldo.map((v, i) => i >= ini ? v - rem * (i - ini + 1) * 0.95 : v)); const mcCli = 4380 * 0.94 * 0.66; const pagam = rem / mcCli;
      const ok = minAfter >= 30000;
      qc = { titulo: 'Posso contratar alguém?', resposta: ok ? (F[2] >= 95 ? 'Sim. O caixa aguenta e a função já está no limite.' : 'O caixa aguenta, mas a função ainda tem espaço.') : 'Com cuidado: o caixa fica abaixo da reserva.', color: ok ? '#6FD3A2' : '#EDB866', border: ok ? 'rgba(111,211,162,0.35)' : 'rgba(237,184,102,0.35)', bg: ok ? 'rgba(111,211,162,0.06)' : 'rgba(237,184,102,0.06)',
        linhas: [{ l: 'Custo nos próximos 12 meses', v: this.money0(rem * meses), color: '#EEEEF0' }, { l: 'Efeito no resultado mensal', v: '−' + this.money0(rem), color: '#F08A84' }, { l: 'Menor saldo de caixa depois', v: this.milR(minAfter), color: ok ? '#EEEEF0' : '#F08A84' }, { l: 'Vagas que a pessoa libera', v: '+' + F[1] + ' vagas de ' + F[0].toLowerCase(), color: '#EEEEF0' }, { l: 'Ocupação atual da função', v: F[2] + '%', color: F[2] >= 95 ? '#EDB866' : '#EEEEF0' }, { l: 'Clientes novos que pagam a contratação', v: pagam.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), color: '#EEEEF0' }],
        nota: 'Com o ticket médio de R$ 4.380 e a margem de contribuição média de 66%, cada cliente novo deixa cerca de ' + this.money0(mcCli) + ' por mês. ' + (F[2] >= 95 ? F[0] + ' está em ' + F[2] + '% de ocupação: sem contratar, o próximo cliente já não cabe.' : 'Ainda há vagas: talvez valha contratar só quando a ocupação passar de 95%.'),
        hasEvento: true, evento: () => { this.setState({ events: s.events.concat([{ id: Date.now(), tipo: 'Contratação', desc: F[0] + ', ' + this.money0(rem), mes: Math.min(12, 10 + ini), valor: -rem, conf: 'Provável', rec: false }]), q: null, tab: 'proj' }); this.say('Contratação adicionada à projeção como evento provável'); }, guardar: nav('Guardaria como cenário "Contratar ' + F[0].toLowerCase() + '"') };
    } else if (s.q === 'perder') {
      const C = [['Restaurante Sabor do Mar', 7800, 2482, 1500], ['Grupo Litoral Shopping', 9500, 1958, 0], ['Rede Farma Mais', 8200, 1528, 0], ['Colégio Horizonte Azul', 6400, 1343, 0], ['Imobiliária Costa Norte', 6200, 1635, 0], ['Atlas Engenharia', 5300, 1041, 0], ['BNEX', 3300, 2139, 400]][parseInt(qf.cli, 10)];
      const liq = C[1] * 0.94; const mc = liq - C[2] - C[3]; const resLoss = liq - C[3]; const meses = C[1] / (1.2 * 4380);
      qc = { titulo: 'E se perdermos um cliente?', resposta: 'O resultado cai ' + this.money0(resLoss) + ' por mês, não só a margem de ' + this.money0(mc) + '.', color: '#F08A84', border: 'rgba(240,138,132,0.35)', bg: 'rgba(240,138,132,0.06)',
        linhas: [{ l: 'Receita perdida por mês', v: '−' + this.money0(C[1]), color: '#F08A84' }, { l: 'Margem de contribuição perdida', v: '−' + this.money0(mc), color: '#F08A84' }, { l: 'Equipe que vira ociosidade', v: this.money0(C[2]), color: '#EDB866' }, { l: 'Efeito no resultado em 12 meses', v: '−' + this.money0(resLoss * 12), color: '#F08A84' }, { l: 'Participação na receita', v: this.pct(C[1], 119000, 1), color: '#EEEEF0' }, { l: 'Meses de vendas para repor', v: meses.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), color: '#EEEEF0' }],
        nota: 'A equipe que atendia o cliente continua sendo paga: ' + this.money0(C[2]) + ' por mês viram capacidade ociosa até que outro cliente ocupe as vagas. Por isso o resultado cai mais que a margem de contribuição. Repor exige cerca de ' + meses.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' meses de vendas no ritmo atual (1,2 cliente por mês).',
        hasEvento: true, evento: () => { this.setState({ events: s.events.concat([{ id: Date.now(), tipo: 'Cliente vai sair', desc: C[0] + ' (simulação)', mes: 11, valor: -C[1], conf: 'Provável', rec: true }]), q: null, tab: 'proj' }); this.say('Saída adicionada à projeção como evento provável'); }, guardar: nav('Guardaria como cenário "Perder ' + C[0] + '"') };
    } else if (s.q === 'vender') {
      const meta = this.parse(qf.meta); let novos;
      if (qf.metaTipo === 'mrr') { const decay = Math.pow(0.975, 12); const falt = meta - 96400 * decay; let soma = 0; for (let i = 0; i < 12; i++) soma += Math.pow(0.975, 11 - i); novos = Math.max(0, falt / (4380 * soma)); }
      else { const r0 = this.sim12({ novos: 0, churn: 2.5, pont: 0, fixos: 0, ticket: 4380 }, false); const falt = meta - r0.res; novos = Math.max(0, falt / (4380 * 0.94 * 0.66 * 6.5)); }
      const vagas = novos * 12; const hires = Math.ceil(Math.max(0, vagas - 0) / 11);
      qc = { titulo: 'Quanto preciso vender?', resposta: novos.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' clientes novos por mês, ao ticket de R$ 4.380.', color: novos > 2 ? '#EDB866' : '#6FD3A2', border: '#33363E', bg: '#191B1F',
        linhas: [{ l: 'Ritmo atual', v: '1,2 cliente por mês', color: '#EEEEF0' }, { l: 'Ritmo necessário', v: novos.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' por mês', color: novos > 1.2 ? '#EDB866' : '#6FD3A2' }, { l: 'Receita nova por mês', v: this.money0(novos * 4380), color: '#EEEEF0' }, { l: 'Vagas de social media necessárias em 12 meses', v: Math.round(vagas) + ' (hoje: 0 livres)', color: '#EDB866' }, { l: 'Contratações de social media', v: hires + (hires === 1 ? ' pessoa' : ' pessoas') + ', a primeira no 1º mês', color: '#EEEEF0' }],
        nota: 'A conta considera o churn médio de 2,5% ao mês. Social media já está em 100% de ocupação, então a primeira venda nova já exige capacidade: planejar a contratação junto com a meta comercial.', hasEvento: false, evento: () => {}, guardar: nav('Guardaria como cenário com ' + novos.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' clientes novos por mês') };
    } else if (s.q === 'distribuir') {
      const v = this.parse(qf.dist); const ini = parseInt(qf.distMes, 10); const r2 = this.sim12(s.scen[1].lev, false); const minBefore = Math.min(...r2.saldo.slice(ini)); const minAfter = minBefore - v; const max = Math.max(0, minBefore - 30000); const ok = minAfter >= 30000;
      qc = { titulo: 'Posso distribuir lucros?', resposta: ok ? 'Sim. O caixa continua acima da reserva.' : 'Não com esse valor: o caixa fica abaixo da reserva.', color: ok ? '#6FD3A2' : '#F08A84', border: ok ? 'rgba(111,211,162,0.35)' : 'rgba(240,138,132,0.35)', bg: ok ? 'rgba(111,211,162,0.06)' : 'rgba(240,138,132,0.06)',
        linhas: [{ l: 'Menor saldo projetado antes', v: this.milR(minBefore), color: '#EEEEF0' }, { l: 'Menor saldo depois da distribuição', v: this.milR(minAfter), color: ok ? '#EEEEF0' : '#F08A84' }, { l: 'Reserva mínima', v: 'R$ 30 mil', color: '#EEEEF0' }, { l: 'Máximo que mantém a reserva', v: this.milR(max), color: '#6FD3A2' }],
        nota: 'Considera a projeção base dos próximos 12 meses com as distribuições já planejadas (dezembro, março e junho), a câmera em novembro e as aplicações mensais na reserva.', hasEvento: false, evento: () => {}, guardar: nav('Guardaria como cenário "Distribuição extra"') };
    }

    // ASSISTENTE 2027
    const wz = s.wz; let wzv = {};
    if (wz) {
      const setW = (p) => this.setState({ wz: Object.assign({}, wz, p) });
      const sim = this.simWz(wz);
      const STEPS = ['Receita recorrente', 'Receita pontual', 'Equipe', 'Custos fixos', 'Variáveis e impostos', 'Investimentos e revisão'];
      const INTRO = ['Parte do MRR projetado para dezembro de 2026. Defina quanto quer crescer e quanto espera perder.', 'Projetos e trabalhos pontuais. A sugestão é a média dos últimos 12 meses.', 'Parte da folha atual (Pagamentos, Folha). Acrescente contratações e reajustes. O sistema avisa quando a receita planejada não cabe na equipe.', 'Parte das recorrências de despesa atuais. Mantenha, reajuste ou defina um novo valor.', 'Custos que acompanham a receita, em % dela.', 'Investimentos, distribuição de lucros e a revisão final do ano.'];
      const fld = (l, key, sug, fmt) => ({ l, sug, v: fmt ? fmt(wz[key]) : String(wz[key]).replace('.', ','), on: (e) => setW({ [key]: this.parse(e.target.value) }), isInput: true, isRead: false });
      const rd = (l, v, sug) => ({ l, sug, v, isInput: false, isRead: true, on: () => {} });
      const nf = (v) => v.toLocaleString('pt-BR');
      const fields = [
        [rd('MRR inicial (dez/26 projetado)', this.money0(wz.mrr0), 'Vem da Projeção, com os eventos confirmados'), fld('Novos clientes por mês', 'novos', 'Sugestão: 1,2 (média dos últimos 6 meses)'), fld('Ticket dos novos (R$)', 'ticket', 'Sugestão: R$ 4.380 (ticket médio atual)', nf), fld('Churn mensal (%)', 'churn', 'Sugestão: 2,5% (média de 12 meses, com contrações e pausas)'), fld('Reajuste em janeiro (%)', 'reaj', 'Sugestão: 4,5% (IPCA estimado)')],
        [fld('Receita pontual por mês (R$)', 'pont', 'Sugestão: R$ 16.600 (média de 12 meses)', nf), fld('Sazonalidade: set a nov mais forte (%)', 'saz', 'Padrão de 2026: +20% no último trimestre')],
        [rd('Folha atual', this.money0(28800), 'De Pagamentos, Folha'), fld('Reajuste de remuneração (%)', 'salReaj', 'Aplicado em maio, data-base da maioria dos contratos')],
        [fld('Estrutura e contabilidade (R$/mês)', 'estr', 'Atual: R$ 6.710', nf), fld('Softwares (R$/mês)', 'soft', 'Atual: R$ 9.440, 118% do orçado em 2026', nf), fld('Pró-labore, adm. e comercial (R$/mês)', 'pess', 'Atual: R$ 20.910', nf), fld('Transporte e alimentação (R$/mês)', 'transp', 'Atual: R$ 500', nf)],
        [fld('Impostos (% da receita)', 'imp', 'Sugestão: 6% (alíquota efetiva de 2026)'), fld('Custos variáveis de produção (%)', 'prod', 'Sugestão: 6,8% (média de 12 meses)'), fld('Comissões (% da receita nova)', 'comis', 'Sugestão: 10%')],
        [fld('Investimentos no ano (R$)', 'inv', 'Ex.: computadores em março', nf), fld('Distribuição de lucros (% do resultado)', 'dist', 'Trimestral. 2026: cerca de 60%')]
      ][wz.step - 1];
      const hmN = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      wzv = { wzSteps: STEPS.map((t, i) => ({ n: String(i + 1), t, bar: wz.step >= i + 1 ? accent : '#33363E', fg: wz.step >= i + 1 ? '#EEEEF0' : '#A6A9B1', pick: () => setW({ step: i + 1 }) })), wzIntro: INTRO[wz.step - 1], wzFields: fields,
        wzCapWarn: wz.step === 3 && !!sim.capBreak, wzCapTxt: sim.capBreak ? 'Em ' + hmN[sim.capBreak.m] + '/27 o plano precisa de ' + Math.ceil(sim.capBreak.used) + ' vagas de social media e a equipe tem ' + sim.capBreak.cap + '. Planejar uma contratação?' : '', wzAddHire: () => setW({ hires: wz.hires.concat([{ f: 'Social Media', m: sim.capBreak.m, v: 3500 }]) }),
        wzHasHires: wz.step === 3 && wz.hires.length > 0, wzHires: wz.hires.map((h, i) => ({ f: h.f, m: 'a partir de ' + hmN[h.m], v: this.money0(h.v), remove: () => setW({ hires: wz.hires.filter((_, j) => j !== i) }) })),
        wzStep6: wz.step === 6, wzDre: { head: hmN.slice(1).map((m) => ({ m })), rows: [['Receita', (x) => x.rb, '400'], ['Custos e despesas', (x) => -(x.rb - x.r), '400'], ['Resultado', (x) => x.r, '700'], ['Caixa', (x) => x.cash, '400']].map(([l, fn, fw]) => ({ l, fw, c: sim.months.map((x) => { const v = fn(x); return { v: this.mil(v, 0), color: v < 0 ? '#F08A84' : '#EEEEF0' }; }) })) },
        wzPrev: [{ l: 'Receita de 2027', v: this.mi(sim.rb), s: this.pct(sim.recR, sim.rb, 0) + ' recorrente', color: '#EEEEF0' }, { l: 'Resultado de 2027', v: this.milR(sim.r), s: 'Margem operacional de ' + this.pct(sim.r + 600, sim.rl, 1), color: sim.r < 0 ? '#F08A84' : '#EEEEF0' }, { l: 'MRR em dezembro de 2027', v: this.money0(sim.mrrEnd), s: (sim.mrrEnd >= wz.mrr0 ? '+' : '') + this.pct(sim.mrrEnd - wz.mrr0, wz.mrr0, 0) + ' no ano', color: '#EEEEF0' }, { l: 'Menor saldo de caixa', v: this.milR(sim.minCash), s: 'em ' + hmN[sim.minM] + '/27' + (sim.minCash < 30000 ? ', abaixo da reserva' : ''), color: sim.minCash < 30000 ? '#F08A84' : '#EEEEF0' }, { l: 'Equipe no fim do ano', v: this.money0(sim.eqEnd) + '/mês', s: wz.hires.length + (wz.hires.length === 1 ? ' contratação planejada' : ' contratações planejadas'), color: '#EEEEF0' }, { l: 'Capacidade de social media', v: sim.capBreak ? 'Estoura em ' + hmN[sim.capBreak.m] : 'Comporta o plano', s: sim.capBreak ? 'Planeje uma contratação no passo 3' : 'Com as contratações planejadas', color: sim.capBreak ? '#EDB866' : '#6FD3A2' }],
        wzVoltarLbl: wz.step === 1 ? 'Cancelar' : 'Voltar', wzVoltar: () => wz.step === 1 ? this.setState({ wz: null }) : setW({ step: wz.step - 1 }),
        wzAvancarLbl: wz.step === 6 ? 'Aprovar orçamento de 2027' : 'Continuar', wzAvancar: () => { if (wz.step < 6) setW({ step: wz.step + 1 }); else { this.setState({ wz: null, budget27: true }); this.say('Orçamento de 2027 aprovado (v1). Passa a valer como referência em janeiro'); } } };
    }

    return Object.assign({
      accent, versaoTxt: s.budget27 ? 'Orçamento 2026 v1 · 2027 v1 aprovado' : 'Orçamento 2026 v1, aprovado em 15/12/2025', wzBtn: s.budget27 ? 'Ver orçamento de 2027' : 'Montar orçamento de 2027', abrirWz: () => this.setState({ wz: this.wzInit(null, 0) }),
      rot, abrirRev: () => this.setState({ revOpen: true, revStep: 1 }),
      tabs: [['orc', 'Orçamento'], ['proj', 'Projeção'], ['cen', 'Cenários']].map(([k, label]) => ({ label, on: s.tab === k, fg: s.tab === k ? '#EEEEF0' : '#A6A9B1', fw: s.tab === k ? '600' : '500', line: s.tab === k ? accent : 'transparent', pick: () => this.setState({ tab: k }) })),
      tabOrc: s.tab === 'orc', tabProj: s.tab === 'proj', tabCen: s.tab === 'cen',
      metas, oxr, pers, mesLabel: MNF[s.mes], mesPrev: () => this.setState({ mes: Math.max(1, s.mes - 1) }), mesNext: () => this.setState({ mes: Math.min(9, s.mes + 1) }),
      oxrSub: s.per === 'mes' ? (s.mes === 9 ? 'Setembro em aberto: realizado + previsto.' : MNF[s.mes] + ' fechado. Clique no realizado para ver os lançamentos.') : 'Acumulado de janeiro a ' + MNF[s.mes].toLowerCase() + '.',
      premissas, criarRevisao: nav('Criaria "Orçamento 2026, revisão de setembro", copiando as premissas. A versão original continua para comparação'),
      revOpen: s.revOpen, closeRev: () => this.setState({ revOpen: false }), revSteps, desvios, rev1: s.revStep === 1, rev2: s.revStep === 2, rev3: s.revStep === 3, revResumo,
      revVoltarLbl: s.revStep === 1 ? 'Fechar' : 'Voltar', revVoltar: () => s.revStep === 1 ? this.setState({ revOpen: false }) : this.setState({ revStep: s.revStep - 1 }),
      revAvancarLbl: s.revStep === 3 ? 'Concluir revisão' : 'Continuar', revAvancar: () => { if (s.revStep === 1 && nCls < 3) { this.say('Classifique os 3 desvios como pontual ou permanente'); return; } if (s.revStep < 3) this.setState({ revStep: s.revStep + 1 }); else { this.setState({ revOpen: false, reviewed: true }); this.say('Revisão de agosto concluída e registrada'); } },
      togs, pouso, pch, ptab, evs, evf: s.evf, onEvTipo: (e) => setEvf({ tipo: e.target.value }), onEvDesc: (e) => setEvf({ desc: e.target.value }), onEvMes: (e) => setEvf({ mes: e.target.value }), onEvValor: (e) => setEvf({ valor: e.target.value }), onEvConf: (e) => setEvf({ conf: e.target.value }), addEv,
      perguntas, cens, cenN: String(s.scen.length), cenChart, cenLeg, novoCenario: () => { if (s.scen.length >= 4) { this.say('Até 4 cenários lado a lado'); return; } this.setState({ scen: s.scen.concat([{ id: 'n' + Date.now(), nome: 'Meu cenário', tag: 'personalizado', color: '#EDB866', lev: Object.assign({}, s.scen[1].lev), auto: false }]) }); },
      qOpen: !!s.q, qc, closeQ: () => this.setState({ q: null }), qContratar: s.q === 'contratar', qPerder: s.q === 'perder', qVender: s.q === 'vender', qDistribuir: s.q === 'distribuir', qf,
      onQFuncao: (e) => setQf({ funcao: e.target.value, rem: { SM: '3.500', TR: '5.500', DS: '4.200', AV: '4.150' }[e.target.value] }), onQRem: (e) => setQf({ rem: e.target.value }), onQMes: (e) => setQf({ mes: e.target.value }), onQCli: (e) => setQf({ cli: e.target.value }), onQMetaTipo: (e) => setQf({ metaTipo: e.target.value, meta: e.target.value === 'mrr' ? '120.000' : '500.000' }), onQMeta: (e) => setQf({ meta: e.target.value }), onQDist: (e) => setQf({ dist: e.target.value }), onQDistMes: (e) => setQf({ distMes: e.target.value }),
      wzOpen: !!wz, closeWz: () => this.setState({ wz: null }),
      hasToast: !!s.toast, toast: s.toast || ''
    }, wz ? wzv : { wzSteps: [], wzFields: [], wzHires: [], wzPrev: [], wzDre: { head: [], rows: [] } });
  }
  wzInit(lev, nh) {
    const mrr0 = Math.round(this.projMonth(12).rec);
    return { step: 1, mrr0, novos: lev ? lev.novos : 1.2, ticket: lev ? lev.ticket : 4380, churn: lev ? lev.churn : 2.5, reaj: 4.5, pont: lev ? Math.round(16600 * (1 + lev.pont / 100)) : 16600, saz: 20, salReaj: 5, estr: 6710, soft: lev ? Math.round(9440 * (1 + lev.fixos / 100)) : 9440, pess: 20910, transp: 500, imp: 6, prod: 6.8, comis: 10, inv: 12000, dist: 60, hires: [] };
  }
  simWz(w) {
    let mrr = w.mrr0 * (1 + w.reaj / 100); let used = 22, cap = 22, cash = 84320; let rb = 0, r = 0, rl = 0, recR = 0, minCash = 1e12, minM = 1, capBreak = null, eqEnd = 0; const months = [];
    for (let m = 1; m <= 12; m++) {
      const churnC = 22 * w.churn / 100; used = used - churnC + w.novos; mrr = mrr * (1 - w.churn / 100) + w.novos * w.ticket;
      w.hires.forEach((h) => { if (h.m === m) cap += 11; });
      if (used > cap + 0.01 && !capBreak) capBreak = { m, used, cap };
      const pon = w.pont * (m >= 9 && m <= 11 ? 1 + w.saz / 100 : 1); const rbm = mrr + pon;
      let eq = 28800 * (m >= 5 ? 1 + w.salReaj / 100 : 1); w.hires.forEach((h) => { if (m >= h.m) eq += h.v; }); eqEnd = eq;
      const custos = rbm * w.imp / 100 + rbm * w.prod / 100 + w.novos * w.ticket * w.comis / 100 + eq + w.estr + w.soft + w.pess + w.transp + 50;
      const rm = rbm - custos; rb += rbm; r += rm; rl += rbm * (1 - w.imp / 100); recR += mrr;
      const dist = (m % 3 === 0) ? Math.max(0, r * w.dist / 100 - (months.reduce((a, x) => a + x.dist, 0))) : 0;
      cash += rm * 0.95 - dist - (m === 3 ? w.inv : 0) - 5000; if (cash < minCash) { minCash = cash; minM = m; }
      months.push({ rb: rbm, r: rm, cash, dist });
    }
    return { rb, r, rl, recR, mrrEnd: mrr, minCash, minM, capBreak, months, eqEnd };
  }
}
