/*
MOCKUP — Caixa (Financeiro Viofilme) · FONTE LEGÍVEL · ARQUIVO 3 de 3
Lógica do mockup: estado, DADOS DE EXEMPLO (fictícios, mas coerentes entre si; use como exemplo de cálculo),
derivações e handlers. Os bindings {{ ... }} de mockup_caixa_1_pagina.html e mockup_caixa_2_paineis.html vêm daqui
(principalmente de renderVals()). DCLogic é a classe base do runtime do Claude Design (setState, props).
Props do componente: {"accent":{"editor":"color","default":"#A99BFF","options":["#A99BFF","#F2A97E","#9ADFB5","#E8D27A"]},"$preview":{"width":1440,"height":1500}}
*/
class Component extends DCLogic {
  constructor(...a) {
    super(...a);
    const T = (id, d, m, conta, raw, clean, valor, status, vinc, extra) => Object.assign({ id, d, m, conta, raw, clean, valor, status, vinc, orig: conta === 'Asaas' ? 'Integração' : 'OFX', how: status === 'conc' ? 'Conciliada por sugestão aceita por Iago Lima' : '', sug: null }, extra || {});
    const S = (tipo, nivel, titulo, det, btn, vinc, x) => Object.assign({ tipo, nivel, titulo, det, btn, vinc }, x || {});
    this.state = {
      tab: 'fluxo', conta: null, hz: 30, vencOn: false, compare: false, hover: -1, collapsed: {}, cell: null,
      eTipo: 'todas', eStatus: 'todos', eOrig: 'todas', eq: '', cDir: 'todas',
      txId: null, contaId: null, cpFormOpen: false, cpValor: '', importOpen: false, impStep: 1, impArq: false, imported: false,
      movOpen: null, mf: { de: 'Inter', para: 'Reserva', tipo: 'saida', cat: 'Tarifas bancárias', desc: '', valor: '' },
      opts: null, mode: {}, alt: {}, classif: {}, busca: {}, recent: [], toast: null,
      bsc: [
        { id: 'b1', t: 'Pagamento a Estúdio Som Norte, trilha e locução 1/3', sub: 'Registrado em 24/08, conta Inter, por Iago Lima', dias: 'há 24 dias', v: -900, ago: true },
        { id: 'b2', t: 'Adiantamento a Pedro Alves', sub: 'Registrado em 28/08, conta Sicoob (extrato atrasado)', dias: 'há 20 dias', v: -300, ago: true }
      ],
      tx: [
        T(1, 16, 9, 'Inter', 'PIX RECEB 12.345.678/0001-90 APTO INCORPORACOES', 'PIX recebido de APTO Incorporações', 4500, 'pend', '', { sug: S('exata', 'Correspondência exata', 'APTO, mensalidade set/26', 'Valor e CNPJ conferem. Vence em 24/09: pago 8 dias antes.', 'Conciliar', 'APTO, mensalidade set/26', { exact: true }) }),
        T(2, 16, 9, 'Inter', 'TARIFA PACOTE SERVICOS 09/2026', 'Tarifa do pacote de serviços', -62, 'pend', '', { sug: S('regra', 'Padrão do banco', 'Lançar como Tarifa bancária', 'Texto reconhecido como tarifa do Inter. Vai para resultado financeiro.', 'Lançar e conciliar', 'Tarifa bancária') }),
        T(3, 16, 9, 'Asaas', 'COBRANCA RECEBIDA pay_88213 CASA NOMADE', 'Cobrança recebida de Casa Nómade', 2657.20, 'conc', 'Casa Nómade, mensalidade set/26 + encargos', { how: 'Automática, pelo identificador da cobrança no Asaas' }),
        T(4, 16, 9, 'Asaas', 'TAXA COBRANCA PIX pay_88213', 'Taxa de cobrança do Asaas', -1.99, 'conc', 'Taxa de cobrança Asaas', { how: 'Automática, lançada junto com o recebimento' }),
        T(5, 15, 9, 'Inter', 'PIX RECEB 22.765.431/0001-08 IMOB COSTA NORTE', 'PIX recebido de Imobiliária Costa Norte', 6200, 'pend', '', { sug: S('confirma', 'Correspondência exata', 'Confirma o recebimento registrado em 15/09', 'Baixa manual de Imobiliária Costa Norte aguardando o extrato. Mesmo valor e data.', 'Confirmar', 'Imobiliária Costa Norte, mensalidade set/26', { exact: true }) }),
        T(6, 15, 9, 'Inter', 'PIX RECEB 41.330.112/0001-55 NUVEM PET LTDA', 'PIX recebido de Nuvem Pet', 3000, 'pend', '', { sug: S('multi', 'Sugestão forte', '2 parcelas de Nuvem Pet: agosto e setembro', 'R$ 1.500 + R$ 1.500. Mesmo CNPJ, soma exata.', 'Conciliar com as 2', 'Nuvem Pet, mensalidades ago e set/26') }),
        T(7, 15, 9, 'Inter', 'PIX RECEB 18.220.774/0001-31 GRUPO ORLA', 'PIX recebido de Grupo Orla', 3000, 'pend', '', { sug: S('parcial', 'Sugestão forte', 'Pagamento parcial: vídeo institucional 2/3', 'A parcela é de R$ 6.000 e vence em 21/09. O saldo de R$ 3.000 segue em aberto.', 'Conciliar como parcial', 'Grupo Orla, vídeo institucional 2/3 (parcial)') }),
        T(8, 14, 9, 'Inter', 'PIX RECEB 07.556.901/0001-44 ATLAS ENGENHARIA', 'PIX recebido de Atlas Engenharia', 5382.10, 'pend', '', { sug: S('encargos', 'Sugestão forte', 'Atlas Engenharia, mensalidade set/26 + encargos', 'Parcela de R$ 5.300 + R$ 82,10 de multa e juros. Venceu em 05/09.', 'Conciliar com encargos', 'Atlas Engenharia, mensalidade set/26 + R$ 82,10 de encargos') }),
        T(9, 13, 9, 'Inter', 'PIX RECEB 33.901.245/0001-70 ESTUDIO BRISA', 'PIX recebido de Estúdio Brisa', 1650, 'pend', '', { sug: S('exata', 'Correspondência exata', 'Estúdio Brisa, mensalidade set/26', 'Valor e CNPJ conferem. Venceu em 12/09, paga 1 dia depois, sem encargos.', 'Conciliar', 'Estúdio Brisa, mensalidade set/26', { exact: true }) }),
        T(10, 12, 9, 'Asaas', 'TRANSF SALDO P/ CONTA 077-INTER', 'Repasse do Asaas para o Inter', -9800, 'pend', '', { sug: S('transf', 'Transferência detectada', 'Repasse Asaas → Inter', 'Saída no Asaas e entrada de R$ 9.800 no Inter no mesmo dia.', 'Registrar transferência', 'Transferência Asaas → Inter', { pair: 11 }) }),
        T(11, 12, 9, 'Inter', 'TED RECEB ASAAS GESTAO FINANCEIRA', 'TED recebida do Asaas', 9800, 'pend', '', { hide: true }),
        T(12, 12, 9, 'Inter', 'PIX ENV PEDROALVES.FOTO@GMAIL.COM', 'PIX enviado a Pedro Alves', -950, 'conc', 'Pedro Alves, fotografia de pratos'),
        T(13, 12, 9, 'Inter', 'PIX RECEB 29.118.340/0001-02 CONSTRUTORA HORIZONTE', 'PIX recebido de Construtora Horizonte', 4000, 'conc', 'Construtora Horizonte, campanha 1/2 (sinal)'),
        T(14, 11, 9, 'Asaas', 'COBRANCA RECEBIDA pay_87990 CAFE AROMA', 'Cobrança recebida de Café Aroma', 3100, 'conc', 'Café Aroma, mensalidade set/26', { how: 'Automática, pelo identificador da cobrança no Asaas' }),
        T(15, 11, 9, 'Inter', 'PIX RECEB ***.482.117-** M F SOUZA', 'PIX recebido de pessoa física', 2900, 'pend', '', { sug: S('media', 'Sugestão', 'Qual lançamento este PIX paga?', 'Mesmo valor, sem CNPJ da contraparte. Confira antes de conciliar.', 'Conciliar com a escolhida', '', { alts: ['Ótica Visão Clara, mensalidade set/26 (vence 28/09)', 'Ótica Visão Clara, mensalidade out/26 (vence 28/10)', 'Nenhuma: é outra receita'] }) }),
        T(16, 10, 9, 'Inter', 'PIX ENV 09.876.543/0001-21 CONTABILIDADE AGIL', 'PIX enviado a Contabilidade Ágil', -1400, 'conc', 'Contabilidade Ágil, honorários agosto'),
        T(17, 9, 9, 'Inter', 'TED ENV 51.009.228/0001-66 GRAFICA RAPIDA ES', 'TED enviada a Gráfica Rápida ES', -780, 'pend', '', { sug: S('confirma', 'Correspondência exata', 'Confirma o pagamento registrado em 09/09', 'Baixa manual a Gráfica Rápida ES aguardando o extrato. Mesmo valor e data.', 'Confirmar', 'Gráfica Rápida ES, impressão de materiais', { exact: true }) }),
        T(18, 8, 9, 'Asaas', 'COBRANCA RECEBIDA pay_87412 STUDIO PILATES', 'Cobrança recebida de Studio Pilates Ápice', 2200, 'conc', 'Studio Pilates Ápice, mensalidade set/26', { how: 'Automática, pelo identificador da cobrança no Asaas' }),
        T(19, 8, 9, 'Sicoob', 'PIX RECEB 55.444.333/0001-22 CLINICA BEM VIVER', 'PIX recebido de Clínica Bem Viver', 3200, 'pend', '', { sug: S('classif', 'Nada encontrado', 'Classifique esta entrada', 'Não há cliente nem parcela com este CNPJ. Pode ser um cliente novo ou um serviço avulso.', 'Classificar e conciliar', '') }),
        T(20, 5, 9, 'Inter', 'PIX ENV LOTE 11 PAGAMENTOS', 'Folha de agosto, 11 pagamentos', -47600, 'conc', 'Folha de agosto (11 títulos)'),
        T(21, 5, 9, 'Asaas', 'COBRANCA RECEBIDA pay_86901 MAR AZUL POUSADA', 'Cobrança recebida de Mar Azul Pousada', 3900, 'conc', 'Mar Azul Pousada, mensalidade set/26', { how: 'Automática, pelo identificador da cobrança no Asaas' }),
        T(22, 3, 9, 'Inter', 'PIX ENV 08.112.334/0001-09 KABUM COMERCIO', 'PIX enviado a Kabum', -1890, 'conc', 'Kabum, SSD e cartões de memória (investimento)'),
        T(23, 2, 9, 'Inter', 'COMPRA DEB POSTO SHELL VIX 02/09', 'Compra no débito, Posto Shell', -95, 'pend', '', { sug: S('regra', 'Regra aprendida', 'Criar despesa: Posto Shell, Transporte', 'Regra "POSTO SHELL" → Transporte, confirmada 4 vezes.', 'Criar e conciliar', 'Posto Shell, transporte') }),
        T(24, 1, 9, 'Sicoob', 'RENDIMENTO APLIC AUTOMATICA', 'Rendimento da aplicação automática', 18.40, 'pend', '', { sug: S('regra', 'Padrão do banco', 'Lançar como Rendimento', 'Texto reconhecido como rendimento. Vai para resultado financeiro.', 'Lançar e conciliar', 'Rendimento') }),
        T(25, 25, 8, 'Inter', 'PAG FATURA CARTAO FINAL 4471', 'Pagamento da fatura do Cartão Inter', -2311.40, 'conc', 'Transferência Inter → Cartão Inter (fatura de agosto)'),
        T(26, 20, 8, 'Inter', 'PAG DARF/DAS 08/2026', 'DAS de julho', -7020, 'conc', 'Receita Federal, DAS competência julho'),
        T(27, 18, 8, 'Inter', 'PAG BOLETO IMOB PRAIA MAR', 'Aluguel de agosto', -4200, 'conc', 'Imobiliária Praia Mar, aluguel agosto')
      ]
    };
  }
  money(n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  money0(n) { return (n < 0 ? '−R$ ' : 'R$ ') + Math.abs(Math.round(n)).toLocaleString('pt-BR'); }
  num0(n) { const r = Math.round(n); return r === 0 ? '—' : (r < 0 ? '−' : '') + Math.abs(r).toLocaleString('pt-BR'); }
  mil(n) { return (n < 0 ? '−' : '') + 'R$ ' + (Math.abs(n) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(n) >= 100000 ? 0 : 1 }) + ' mil'; }
  parse(s) { const v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(v) ? 0 : v; }
  dd(n) { return String(n).padStart(2, '0'); }
  say(msg) { this.setState({ toast: msg }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 3600); }
  componentWillUnmount() { clearTimeout(this._t); }
  mes(m) { return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m]; }
  engine(anchor, share, vencOn) {
    const TPL = [[1, 12000, 'rec', 'Mensalidades de 4 clientes'], [5, 9200, 'rec', 'Atlas Engenharia e Mar Azul Pousada'], [7, 8800, 'rec', 'Mensalidades de 2 clientes'], [8, 2200, 'rec', 'Studio Pilates Ápice'], [10, 9200, 'rec', 'Café Aroma, Casa Nómade e outro'], [12, 1650, 'rec', 'Estúdio Brisa'], [13, 13200, 'rec', 'Mensalidades de 3 clientes'], [14, 9700, 'rec', 'Nuvem Pet e outros'], [15, 16200, 'rec', 'Imobiliária Costa Norte e outros'], [17, 4800, 'rec', 'Clínica Vitta'], [20, 5700, 'rec', 'Mensalidades de 2 clientes'], [22, 3300, 'rec', 'BNEX'], [24, 4500, 'rec', 'APTO'], [25, 7800, 'rec', 'Restaurante Sabor do Mar'], [28, 2900, 'rec', 'Ótica Visão Clara'], [30, 1800, 'rec', 'Padaria Trigo Fino'], [16, 380, 'outras', 'Reembolsos e outras entradas'], [5, -48670, 'equipe', 'Folha e pró-labore'], [9, -780, 'diretos', 'Materiais de produção'], [12, -950, 'diretos', 'Freelancers'], [23, -2100, 'diretos', 'Freelancers e locações'], [10, -1400, 'estrutura', 'Contabilidade'], [15, -320, 'estrutura', 'Seguro de equipamentos'], [17, -370.1, 'estrutura', 'Google Workspace'], [18, -4500, 'estrutura', 'Aluguel e energia'], [28, -489.9, 'estrutura', 'Internet'], [20, -8350, 'impostos', 'DAS e INSS'], [25, -2400, 'cartao', 'Fatura do Cartão Inter'], [1, -62, 'finres', 'Tarifas bancárias'], [26, -5000, 'reserva', 'Aplicação na reserva']];
    const SP = { '2026-9-3': [[-1890, 'invest', 'Kabum, SSD e cartões']], '2026-3-10': [[-90000, 'socios', 'Distribuição de lucros, 1º trimestre']], '2026-6-10': [[-90000, 'socios', 'Distribuição de lucros, 2º trimestre']], '2026-9-10': [[-60000, 'socios', 'Distribuição de lucros, 3º trimestre']], '2026-12-10': [[-90000, 'socios', 'Distribuição de lucros (planejada)']], '2027-3-10': [[-90000, 'socios', 'Distribuição de lucros (planejada)']], '2027-6-10': [[-90000, 'socios', 'Distribuição de lucros (planejada)']], '2026-11-20': [[-18900, 'invest', 'Câmera de cinema (compra programada)']], '2026-9-17': [[-1850, 'diretos', 'Lucas Prado, captação (vencido)']], '2026-8-21': [[6000, 'rec', 'Grupo Orla, vídeo 1/3']], '2026-9-21': [[6000, 'rec', 'Grupo Orla, vídeo 2/3']], '2026-10-21': [[6000, 'rec', 'Grupo Orla, vídeo 3/3']] };
    const CARD = { '2026-7': -2194.8, '2026-8': -2311.4, '2026-9': -2608.03, '2026-10': -1681.73 };
    const LO = -200, HI = 380;
    const days = [];
    for (let i = LO; i <= HI; i++) {
      const dt = new Date(2026, 8, 17 + i); const d = dt.getDate(); const key = dt.getFullYear() + '-' + (dt.getMonth() + 1);
      const ev = [];
      TPL.forEach((t) => { if (t[0] !== d) return; let v = t[1]; if (t[2] === 'cartao' && CARD[key] !== undefined) v = CARD[key]; if (i < 0) { let f = t[2] === 'rec' ? 1 + ((((i * 7919) % 13) + 13) % 13 - 6) / 100 : 1 + ((((i * 104729) % 7) + 7) % 7 - 3) / 100; if (t[2] === 'rec') f = f * (1 + i / 1400); v = Math.round(v * f * 100) / 100; } ev.push({ v: v * share, line: t[2], label: t[3] }); });
      (SP[key + '-' + d] || []).forEach((s) => ev.push({ v: s[0] * share, line: s[1], label: s[2] }));
      if (vencOn && i === 1) ev.push({ v: 8450 * share, line: 'rec', label: 'Recebimentos vencidos, se pagos' });
      days.push({ i, dt, ev, net: ev.reduce((a, e) => a + e.v, 0), real: i < 0 });
    }
    const idx = (i) => i - LO;
    const sEnd = new Array(days.length);
    sEnd[idx(-1)] = anchor;
    for (let i = 0; i <= HI; i++) sEnd[idx(i)] = sEnd[idx(i - 1)] + days[idx(i)].net;
    for (let i = -2; i >= LO; i--) sEnd[idx(i)] = sEnd[idx(i + 1)] - days[idx(i + 1)].net;
    return { days, sEnd, idx, LO, HI };
  }
  renderVals() {
    const s = this.state; const accent = this.props.accent ?? '#A99BFF';
    const S0 = { tipo: 'classif', nivel: 'Nada encontrado', titulo: 'Classifique', det: '', btn: 'Classificar e conciliar', vinc: '' };
    const sicoob = s.imported ? 11512.40 : 11200;
    const disp = 58470 + 14650 + sicoob;
    const nav = (t) => () => this.say(t);
    const pendAll = s.tx.filter((t) => t.status === 'pend' && !t.hide);
    const pendBy = (c) => s.tx.filter((t) => t.status === 'pend' && t.conta === c).length;
    const accts = [
      { id: 'Inter', nome: 'Inter', tipo: 'Banco', dot: '#EDA35A', saldo: 58470, disp: true, st: pendBy('Inter') ? 'Confere com o banco em 16/09. ' + pendBy('Inter') + ' para conciliar' : 'Confere com o banco em 16/09', stColor: pendBy('Inter') ? '#C9CBD1' : '#6FD3A2' },
      { id: 'Asaas', nome: 'Asaas', tipo: 'Gateway de pagamento', dot: '#7FC8F8', saldo: 14650, disp: true, st: 'Confere. Liquidez D+1, repasse semanal', stColor: '#6FD3A2' },
      { id: 'Sicoob', nome: 'Sicoob', tipo: 'Banco', dot: '#6FD3A2', saldo: sicoob, disp: true, st: s.imported ? 'Confere com o banco em 16/09' : 'Diferença de R$ 312,40 com o banco. Extrato há 8 dias', stColor: s.imported ? '#6FD3A2' : '#F08A84' },
      { id: 'Reserva', nome: 'Reserva', tipo: 'Reserva, fora do disponível', dot: '#C4B9FF', saldo: 30000, disp: false, st: 'Fora do disponível. Rendeu R$ 214 em agosto', stColor: '#A6A9B1' },
      { id: 'Cartão', nome: 'Cartão Inter', tipo: 'Cartão de crédito', dot: '#F08A84', saldo: -2608.03, disp: false, st: 'Fatura de R$ 2.608, vence 25/09', stColor: '#A6A9B1' }
    ];
    const contas = accts.map((c) => { const on = s.conta === c.id; return { nome: c.nome, saldo: this.money(c.saldo), saldoColor: c.saldo < 0 ? '#F08A84' : '#EEEEF0', st: c.st, stColor: c.stColor, dot: c.dot, on, border: on ? accent : (c.id === 'Sicoob' && !s.imported ? 'rgba(240,138,132,0.45)' : '#2C2F36'), bg: c.disp ? '#1D1F24' : '#191A1E', pick: () => this.setState({ conta: on ? null : c.id, hover: -1 }), ficha: () => this.setState({ contaId: c.id, cpFormOpen: false }) }; });
    const acc = accts.find((c) => c.id === s.conta);

    const tabs = [['fluxo', 'Fluxo de caixa', null], ['extrato', 'Extrato', null], ['conc', 'Conciliação', String(pendAll.length + s.bsc.length)]].map(([k, label, badge]) => ({ label, on: s.tab === k, fg: s.tab === k ? '#EEEEF0' : '#A6A9B1', fw: s.tab === k ? '600' : '500', line: s.tab === k ? accent : 'transparent', hasBadge: !!badge && badge !== '0', badge: badge || '', pick: () => this.setState({ tab: k, hover: -1 }) }));

    // FLUXO
    const foraDisp = acc && !acc.disp;
    const anchor = acc ? acc.saldo : disp; const share = acc ? acc.saldo / disp : 1;
    const E = this.engine(anchor, share, s.vencOn);
    const { days, sEnd, idx } = E;
    const H = s.hz;
    let buckets = [];
    if (H === 30 || H === 60) { for (let i = -H; i < H; i++) buckets.push({ i0: i, i1: i, label: this.dd(days[idx(i)].dt.getDate()) + '/' + this.dd(days[idx(i)].dt.getMonth() + 1) }); }
    else if (H === 90) { for (let k = -13; k < 13; k++) { const i0 = k * 7, i1 = k * 7 + 6; buckets.push({ i0, i1, label: 'sem. ' + this.dd(days[idx(i0)].dt.getDate()) + '/' + this.dd(days[idx(i0)].dt.getMonth() + 1) }); } }
    else { for (let m = 2; m <= 20; m++) { const first = new Date(2026, m, 1); const last = new Date(2026, m + 1, 0); const i0 = Math.round((first - new Date(2026, 8, 17)) / 864e5); const i1 = Math.round((last - new Date(2026, 8, 17)) / 864e5); buckets.push({ i0, i1, label: this.mes(first.getMonth()) + (first.getFullYear() === 2027 ? '/27' : '') }); } }
    buckets = buckets.map((b) => { let entr = 0, said = 0; const evs = []; for (let i = b.i0; i <= b.i1; i++) { const dy = days[idx(i)]; dy.ev.forEach((e) => { if (e.v > 0) entr += e.v; else said += e.v; evs.push(e); }); } const tipo = b.i1 < 0 ? 'realizado' : b.i0 < 0 ? 'realizado + previsto' : 'previsto'; return Object.assign(b, { entr, said, saldo: sEnd[idx(b.i1)], tipo, evs }); });
    const N = buckets.length; const W = 1014; const colW = W / N;
    const futureFrom = buckets.findIndex((b) => b.i1 >= 0);
    const vis = buckets.map((b) => b.saldo);
    const yMax = Math.max(...vis, 30000) * 1.12; const yMin = Math.min(0, Math.min(...vis) * 1.1);
    const Y = (v) => 10 + 160 * (1 - (v - yMin) / (yMax - yMin));
    const pts = buckets.map((b, k) => [(k + 0.5) * colW, Y(b.saldo)]);
    const toPath = (arr) => arr.length ? 'M ' + arr.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ') : '';
    const realPath = toPath(pts.slice(0, Math.max(1, futureFrom + 1)));
    const prevPath = toPath(pts.slice(Math.max(0, futureFrom)));
    const areaPath = toPath(pts) + ' L ' + pts[N - 1][0].toFixed(1) + ' 170 L ' + pts[0][0].toFixed(1) + ' 170 Z';
    let todayX; if (H === 365) { const b = buckets[futureFrom]; todayX = (futureFrom + (0 - b.i0) / (b.i1 - b.i0 + 1)) * colW; } else todayX = futureFrom * colW;
    
    const step = (yMax - yMin) / 4; const nice = step > 50000 ? 50000 : step > 20000 ? 20000 : 10000; const tickVals = []; for (let v = Math.ceil(yMin / nice) * nice + nice; v < yMax; v += nice) tickVals.push(v);
    const tv = tickVals.slice(-3);
    const yTicks = tv.map((v) => ({ top: Y(v) - 7, label: this.mil(v) }));
    const g = tv.map((v) => Y(v).toFixed(1));
    const maxAbs = Math.max(1, ...buckets.map((b) => Math.max(b.entr, -b.said)));
    const bars = buckets.map((b, k) => { const fut = b.i1 >= 0 && !(b.i0 < 0); const mixed = b.i0 < 0 && b.i1 >= 0; const hIn = b.entr ? Math.max(2, b.entr / maxAbs * 52) : 0; const hOut = b.said ? Math.max(2, -b.said / maxAbs * 52) : 0;
      return { hIn: hIn.toFixed(1), hOut: hOut.toFixed(1), inBg: fut ? 'rgba(111,211,162,0.18)' : '#6FD3A2', inBorder: fut || mixed ? '1px solid #6FD3A2' : 'none', outBg: fut ? 'rgba(143,147,160,0.18)' : '#8F93A0', outBorder: fut || mixed ? '1px solid #8F93A0' : 'none', colBg: k === s.hover ? 'rgba(238,238,240,0.05)' : (k === futureFrom && H !== 365 ? 'rgba(169,155,255,0.06)' : 'transparent'),
        enter: () => { if (this.state.hover !== k) this.setState({ hover: k }); }, click: () => { const dt = new Date(2026, 8, 17 + b.i0); this.setState({ cell: { y: dt.getFullYear(), m: dt.getMonth(), line: null, bucket: k } }); } }; });
    const nL = 5; const xLabels = []; for (let j = 0; j < nL; j++) { const k = Math.min(N - 1, Math.round(j * (N - 1) / (nL - 1))); xLabels.push({ t: buckets[k].label }); }
    const hv = s.hover >= 0 && s.hover < N ? buckets[s.hover] : null;
    const tip = hv ? { label: hv.label, tipo: hv.tipo, entr: this.money0(hv.entr), said: this.money0(hv.said), saldo: this.money0(hv.saldo), top: hv.evs.slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 3).map((e) => ({ l: e.label, v: this.num0(e.v) })) } : { top: [] };
    let fEntr = 0, fSaid = 0; for (let i = 0; i < H; i++) days[idx(i)].ev.forEach((e) => { if (e.v > 0) fEntr += e.v; else fSaid += e.v; });
    let minI = 0; for (let i = 0; i < H; i++) if (sEnd[idx(i)] < sEnd[idx(minI)]) minI = i;
    const minDt = days[idx(minI)].dt; const minV = sEnd[idx(minI)];
    let minK = buckets.findIndex((b) => b.i0 <= minI && b.i1 >= minI); if (minK < 0) minK = futureFrom;
    const avgOut = (() => { let t = 0; for (let i = -90; i < 0; i++) days[idx(i)].ev.forEach((e) => { if (e.v < 0 && ['socios', 'reserva', 'invest'].indexOf(e.line) < 0) t += -e.v; }); return t / 3; })();
    const resumo = [
      { label: 'Saldo hoje', val: this.money0(anchor), sub: acc ? acc.nome : 'Disponível consolidado', color: '#EEEEF0' },
      { label: 'Entradas previstas', val: this.money0(fEntr), sub: 'Próximos ' + (H === 365 ? '12 meses' : H + ' dias'), color: '#6FD3A2' },
      { label: 'Saídas previstas', val: this.money0(fSaid), sub: 'Inclui reserva e distribuições', color: '#EEEEF0' },
      { label: 'Saldo no fim', val: this.money0(sEnd[idx(H - 1)]), sub: 'Em ' + this.dd(days[idx(H - 1)].dt.getDate()) + '/' + this.dd(days[idx(H - 1)].dt.getMonth() + 1) + '/' + days[idx(H - 1)].dt.getFullYear(), color: '#EEEEF0' },
      { label: 'Menor saldo', val: this.money0(minV), sub: 'Em ' + this.dd(minDt.getDate()) + '/' + this.dd(minDt.getMonth() + 1) + (minV < 30000 * share ? ', abaixo da reserva' : ', acima da reserva'), color: minV < 30000 * share ? '#F08A84' : '#EEEEF0' },
      { label: 'Fôlego', val: (anchor / avgOut).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' meses', sub: 'Pela média de saídas de 3 meses', color: '#EEEEF0' }
    ];
    const hzs = [[30, '30 dias'], [60, '60 dias'], [90, '90 dias'], [365, '12 meses']].map(([k, label]) => ({ label, on: s.hz === k, bg: s.hz === k ? '#2C2F36' : 'transparent', fg: s.hz === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ hz: k, hover: -1 }) }));

    // TABELA
    const LINES = [['op', 'OPERACIONAL', null], ['rec', 'Recebimentos de clientes', 'op'], ['outras', 'Outras receitas', 'op'], ['equipe', 'Equipe e pró-labore', 'op'], ['diretos', 'Custos diretos', 'op'], ['estrutura', 'Estrutura e softwares', 'op'], ['impostos', 'Impostos', 'op'], ['cartao', 'Faturas de cartão', 'op'], ['finres', 'Tarifas e rendimentos', 'op'], ['inv', 'INVESTIMENTOS', null], ['invest', 'Equipamentos', 'inv'], ['fin', 'SÓCIOS E FINANCIAMENTO', null], ['socios', 'Distribuição de lucros', 'fin'], ['int', 'ENTRE CONTAS', null], ['reserva', 'Aplicações na reserva', 'int']];
    const endD = new Date(2026, 8, 17 + H - 1);
    const months = []; for (let y = 2026, m = 6; y < endD.getFullYear() || (y === endD.getFullYear() && m <= endD.getMonth()); m++) { if (m > 11) { m = 0; y++; } months.push([y, m]); if (y === endD.getFullYear() && m === endD.getMonth()) break; }
    const mRange = ([y, m]) => { const i0 = Math.round((new Date(y, m, 1) - new Date(2026, 8, 17)) / 864e5); const i1 = Math.round((new Date(y, m + 1, 0) - new Date(2026, 8, 17)) / 864e5); return [Math.max(i0, E.LO), Math.min(i1, E.HI)]; };
    const mSum = (ym, line) => { const [a, b] = mRange(ym); let t = 0; for (let i = a; i <= b; i++) days[idx(i)].ev.forEach((e) => { if (e.line === line) t += e.v; }); return t; };
    const blockOf = {}; LINES.forEach((l) => { if (l[2]) blockOf[l[0]] = l[2]; });
    const cellColor = (v) => v > 0 ? '#6FD3A2' : v < 0 ? '#EEEEF0' : '#6E727B';
    const colTipo = (ym) => { const [a, b] = mRange(ym); return b < 0 ? 'realizado' : a < 0 ? 'real + prev' : (ym[1] + ym[0] * 12 > 2026 * 12 + 10 ? 'projetado' : 'previsto'); };
    const colBg = (ym) => { const t = colTipo(ym); return t === 'realizado' ? 'transparent' : t === 'real + prev' ? 'rgba(169,155,255,0.05)' : 'rgba(238,238,240,0.025)'; };
    const tblHead = months.map((ym) => ({ m: this.mes(ym[1]) + (ym[0] === 2027 ? '/27' : ''), tipo: colTipo(ym), bg: colBg(ym) }));
    const tblCols = '240px repeat(' + months.length + ', 118px)';
    const tblMinW = 240 + months.length * 118;
    const openCell = (ym, line) => () => this.setState({ cell: { y: ym[0], m: ym[1], line } });
    const tblRows = [];
    const saldoRow = (label, fn, strong) => tblRows.push({ isBlock: false, isPlain: true, label, indent: 22, labelColor: '#EEEEF0', fw: strong ? '700' : '600', bg: '#1A1C20', stickyBg: '#1A1C20', line: '#2A2D33', cells: months.map((ym) => ({ v: this.num0(fn(ym)), color: '#EEEEF0', bg: colBg(ym), noClick: true, cursor: 'default', open: () => {} })) });
    saldoRow('Saldo inicial', (ym) => sEnd[idx(mRange(ym)[0] - 1)]);
    LINES.forEach((l) => {
      if (!l[2]) { const coll = !!s.collapsed[l[0]]; const kids = LINES.filter((x) => x[2] === l[0]).map((x) => x[0]); tblRows.push({ isBlock: true, isPlain: false, label: l[1], chev: coll ? 'none' : 'rotate(90deg)', toggle: () => { const c = Object.assign({}, s.collapsed); c[l[0]] = !coll; this.setState({ collapsed: c }); }, fw: '700', bg: '#1F2126', stickyBg: '#1F2126', line: '#2A2D33', cells: months.map((ym) => { const v = kids.reduce((a, k) => a + mSum(ym, k), 0); return { v: this.num0(v), color: cellColor(v), bg: colBg(ym), noClick: true, cursor: 'default', open: () => {} }; }) }); }
      else if (!s.collapsed[l[2]]) tblRows.push({ isBlock: false, isPlain: true, label: l[1], indent: 42, labelColor: '#C9CBD1', fw: '400', bg: 'transparent', stickyBg: '#1D1F24', line: '#25282D', cells: months.map((ym) => { const v = mSum(ym, l[0]); return { v: this.num0(v), color: cellColor(v), bg: colBg(ym), noClick: v === 0, cursor: v === 0 ? 'default' : 'pointer', open: openCell(ym, l[0]) }; }) });
    });
    saldoRow('Saldo final', (ym) => sEnd[idx(mRange(ym)[1])], true);
    if (s.compare) tblRows.push({ isBlock: false, isPlain: true, label: 'Diferença vs. previsto no início do mês', indent: 22, labelColor: '#A6A9B1', fw: '400', bg: 'transparent', stickyBg: '#1D1F24', line: '#25282D', cells: months.map((ym, k) => { const v = k === 0 ? 2340 : k === 1 ? -1120 : k === 2 ? 860 : 0; return { v: v ? (v > 0 ? '+' : '−') + Math.abs(v).toLocaleString('pt-BR') : '—', color: v > 0 ? '#6FD3A2' : v < 0 ? '#EDB866' : '#6E727B', bg: colBg(ym), noClick: true, cursor: 'default', open: () => {} }; }) });

    let cell = { itens: [] };
    if (s.cell) {
      const ym = [s.cell.y, s.cell.m]; const [a, b] = s.cell.bucket !== undefined ? [buckets[s.cell.bucket].i0, buckets[s.cell.bucket].i1] : mRange(ym);
      const its = []; for (let i = a; i <= b; i++) days[idx(i)].ev.forEach((e) => { if (s.cell.line && e.line !== s.cell.line) return; const dt = days[idx(i)].dt; const proj = i >= 0 && (dt.getFullYear() * 12 + dt.getMonth() > 2026 * 12 + 10); its.push({ d: this.dd(dt.getDate()) + '/' + this.dd(dt.getMonth() + 1), l: e.label, v: this.num0(e.v), raw: e.v, st: i < 0 ? 'Realizado' : proj ? 'Projetado' : 'Previsto', stFg: i < 0 ? '#6FD3A2' : proj ? '#C4B9FF' : '#86B4F7', stBg: i < 0 ? 'rgba(111,211,162,0.13)' : proj ? 'rgba(169,155,255,0.13)' : 'rgba(134,180,247,0.13)', open: nav(i < 0 ? 'Abriria a movimentação no extrato' : proj ? 'Projetado pela recorrência: ainda não existe como parcela' : 'Abriria a ficha da parcela') }); });
      const tot = its.reduce((x, e) => x + e.raw, 0);
      const ln = s.cell.line ? LINES.find((l) => l[0] === s.cell.line)[1] : 'Todas as movimentações';
      cell = { mes: s.cell.bucket !== undefined ? buckets[s.cell.bucket].label + ', ' + buckets[s.cell.bucket].tipo : this.mes(s.cell.m) + ' de ' + s.cell.y, linha: ln, total: this.money0(tot), sub: its.length + (its.length === 1 ? ' lançamento' : ' lançamentos') + '. Realizado vem das movimentações; previsto, das parcelas; projetado, das regras de recorrência.', itens: its };
    }

    // EXTRATO
    const ql = s.eq.trim().toLowerCase();
    const extr = s.tx.filter((t) => (!s.conta || t.conta === s.conta || (s.conta === 'Cartão' && false)) && (s.eStatus === 'todos' || t.status === s.eStatus) && (s.eOrig === 'todas' || t.orig === s.eOrig) && (s.eTipo === 'todas' || (s.eTipo === 'entr' ? t.valor > 0 : s.eTipo === 'said' ? t.valor < 0 : (t.vinc.startsWith('Transferência') || t.sug && t.sug.tipo === 'transf' || t.hide))) && (!ql || (t.raw + ' ' + t.clean).toLowerCase().includes(ql) || String(Math.round(Math.abs(t.valor))).includes(ql.replace(/\D/g, '') || '§'))).sort((a, b) => (b.m * 40 + b.d) - (a.m * 40 + a.d) || b.id - a.id);
    const single = !!acc && acc.disp;
    const accSaldo = acc ? acc.saldo : 0;
    let running = accSaldo; const runMap = {};
    if (single) { s.tx.filter((t) => t.conta === s.conta && t.status !== 'ign').sort((a, b) => (b.m * 40 + b.d) - (a.m * 40 + a.d) || b.id - a.id).forEach((t) => { runMap[t.id] = running; running -= t.valor; }); }
    const dayKeys = []; extr.forEach((t) => { const k = t.m * 40 + t.d; if (!dayKeys.includes(k)) dayKeys.push(k); });
    const eDias = dayKeys.map((k, kIdx) => { const ts = extr.filter((t) => t.m * 40 + t.d === k); const d = ts[0].d, m = ts[0].m; const lastT = ts[0];
      let hasCp = false, cpTxt = '', cpColor = '#6FD3A2', cpBg = 'rgba(111,211,162,0.06)', cpIcon = 'M5 12l5 5 9-10';
      if (single && kIdx === 0) { hasCp = true; if (s.conta === 'Sicoob' && !s.imported) { cpTxt = 'Saldo do banco em 16/09: R$ 11.512,40. Sistema: R$ 11.200,00. Diferença de R$ 312,40'; cpColor = '#F08A84'; cpBg = 'rgba(240,138,132,0.07)'; cpIcon = 'M12 3l10 18H2L12 3zM12 10v4M12 17.5v.5'; } else cpTxt = 'Saldo do banco em 16/09: ' + this.money(accSaldo) + '. Confere com o sistema'; }
      return { label: this.dd(d) + '/' + this.dd(m) + (d === 16 && m === 9 ? ', ontem' : ''), saldoTxt: single && runMap[lastT.id] !== undefined ? 'Saldo no fim do dia ' + this.money(runMap[lastT.id]) : '', hasCp, cpTxt, cpColor, cpBg, cpIcon,
        rows: ts.map((t) => ({ data: this.dd(t.d) + '/' + this.dd(t.m), clean: t.clean, raw: t.raw, conta: t.conta, vinc: t.status === 'conc' ? t.vinc : t.status === 'ign' ? 'Ignorada: ' + (t.ignReason || 'duplicada') : 'Pendente de conciliação', vincColor: t.status === 'conc' ? '#C9CBD1' : t.status === 'ign' ? '#6E727B' : '#EDB866', entr: t.valor > 0 ? this.money(t.valor) : '', said: t.valor < 0 ? this.money(-t.valor) : '', saldo: single && runMap[t.id] !== undefined ? this.money(runMap[t.id]) : '', stColor: t.status === 'conc' ? '#6FD3A2' : t.status === 'ign' ? '#6E727B' : '#EDB866', stTxt: t.status === 'conc' ? 'Conciliada' : t.status === 'ign' ? 'Ignorada' : 'Pendente', op: t.status === 'ign' ? '0.55' : '1', deco: t.status === 'ign' ? 'line-through' : 'none', open: () => this.setState({ txId: t.id }) })) }; });
    const eTipos = [['todas', 'Todas'], ['entr', 'Entradas'], ['said', 'Saídas'], ['transf', 'Transferências']].map(([k, label]) => ({ label, on: s.eTipo === k, bg: s.eTipo === k ? '#2C2F36' : 'transparent', fg: s.eTipo === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ eTipo: k }) }));

    // CONCILIAÇÃO
    const markConc = (ids, vinc, how) => { const set = new Set(ids); this.setState({ tx: this.state.tx.map((t) => set.has(t.id) ? Object.assign({}, t, { status: 'conc', vinc, how }) : t), recent: this.state.recent.concat(ids.filter((id) => !this.state.tx.find((t) => t.id === id).hide)), opts: null }); };
    const fila = pendAll.filter((t) => (!s.conta || t.conta === s.conta) && (s.cDir === 'todas' || (s.cDir === 'entr' ? t.valor > 0 : t.valor < 0))).sort((a, b) => ((b.sug && b.sug.exact) - (a.sug && a.sug.exact)) || (b.m * 40 + b.d) - (a.m * 40 + a.d)).map((t) => {
      const sg = t.sug || S0; const open = s.opts === t.id; const mode = s.mode[t.id] || 'buscar'; const age = (9 * 40 + 17) - (t.m * 40 + t.d);
      const nivelMap = { exata: ['#6FD3A2', 'rgba(111,211,162,0.13)'], confirma: ['#6FD3A2', 'rgba(111,211,162,0.13)'], multi: ['#86B4F7', 'rgba(134,180,247,0.13)'], parcial: ['#86B4F7', 'rgba(134,180,247,0.13)'], encargos: ['#86B4F7', 'rgba(134,180,247,0.13)'], regra: ['#C4B9FF', 'rgba(169,155,255,0.14)'], transf: ['#C4B9FF', 'rgba(169,155,255,0.14)'], media: ['#EDB866', 'rgba(237,184,102,0.14)'], classif: ['#F08A84', 'rgba(240,138,132,0.14)'] };
      const nv = nivelMap[sg.tipo] || nivelMap.media;
      const altSel = s.alt[t.id] !== undefined ? s.alt[t.id] : 0;
      const cf = s.classif[t.id] || { cat: '', quem: 'Clínica Bem Viver', lembrar: true };
      const setCf = (p) => { const c = Object.assign({}, s.classif); c[t.id] = Object.assign({}, cf, p); this.setState({ classif: c }); };
      const pair = sg.pair ? s.tx.find((x) => x.id === sg.pair) : null;
      const cands = [['Ótica Visão Clara, mensalidade set/26', '28/09', 2900], ['Padaria Trigo Fino, tráfego set/26', '30/09', 1800], ['Nuvem Pet, mensalidade set/26', '14/09', 1500], ['Grupo Orla, vídeo 2/3', '21/09', 6000], ['BNEX, mensalidade set/26', '22/09', 3300]];
      const bsel = s.busca[t.id] || [];
      const selSum = bsel.reduce((a, k) => a + cands[k][2], 0); const dif = Math.abs(t.valor) - selSum;
      let main;
      if (sg.tipo === 'classif') main = () => { if (!cf.cat) { this.say('Escolha a categoria'); return; } markConc([t.id], cf.cat + ', ' + cf.quem, 'Classificada manualmente' + (cf.lembrar ? '. Regra criada para "' + t.raw.split(' ').slice(-2).join(' ') + '"' : '')); this.say('Classificada e conciliada' + (cf.lembrar ? '. As próximas deste pagador serão reconhecidas sozinhas' : '')); };
      else if (sg.tipo === 'media') main = () => { markConc([t.id], sg.alts[altSel], 'Sugestão de confiança média escolhida por Iago Lima'); this.say('Conciliada com: ' + sg.alts[altSel]); };
      else main = () => { markConc(sg.pair ? [t.id, sg.pair] : [t.id], sg.vinc, sg.tipo === 'regra' ? 'Por regra aprendida, confirmada por Iago Lima' : 'Sugestão aceita por Iago Lima (' + sg.nivel.toLowerCase() + ')'); this.say(sg.btn.replace('Conciliar', 'Conciliada').replace('Confirmar', 'Confirmada').replace('Lançar e conciliar', 'Lançada e conciliada').replace('Criar e conciliar', 'Despesa criada e conciliada').replace('Registrar transferência', 'Transferência registrada') + ': ' + (sg.vinc || this.money(t.valor))); };
      return {
        data: this.dd(t.d) + '/' + this.dd(t.m), conta: t.conta, idade: age <= 0 ? 'hoje' : 'há ' + age + (age === 1 ? ' dia' : ' dias'), valor: (t.valor > 0 ? '+ ' : '− ') + this.money(Math.abs(t.valor)), valColor: t.valor > 0 ? '#6FD3A2' : '#EEEEF0', raw: t.raw,
        hasPar: !!pair, par: pair ? 'Par: ' + this.dd(pair.d) + '/' + this.dd(pair.m) + ', ' + pair.conta + ', + ' + this.money(pair.valor) : '',
        border: sg.exact ? 'rgba(111,211,162,0.35)' : '#2C2F36', nivel: sg.nivel, nivelFg: nv[0], nivelBg: nv[1], titulo: sg.titulo, det: sg.det,
        hasAlts: sg.tipo === 'media', alts: (sg.alts || []).map((a, k) => ({ t: a, on: altSel === k, border: altSel === k ? accent : '#33363E', dot: altSel === k ? accent : '#6E727B', fill: altSel === k ? accent : 'transparent', pick: () => { const al = Object.assign({}, s.alt); al[t.id] = k; this.setState({ alt: al }); } })),
        isClassif: sg.tipo === 'classif', cCat: cf.cat, cQuem: cf.quem, onCat: (e) => setCf({ cat: e.target.value }), onQuem: (e) => setCf({ quem: e.target.value }), lembrar: cf.lembrar, toggleLembrar: () => setCf({ lembrar: !cf.lembrar }), lemBorder: cf.lembrar ? accent : '#6E727B', lemFill: cf.lembrar ? accent : 'transparent', lembrarTxt: 'Lembrar para as próximas deste CNPJ',
        mainLabel: sg.btn, mainBg: accent, main,
        optsOpen: open, optsChev: open ? 'rotate(180deg)' : 'none', toggleOpts: () => this.setState({ opts: open ? null : t.id }),
        modes: [['buscar', 'Buscar lançamento'], ['criar', 'Criar lançamento'], ['transf', 'É uma transferência'], ['ignorar', 'Ignorar']].map(([k, label]) => ({ label, on: mode === k, border: mode === k ? accent : '#33363E', bg: mode === k ? 'rgba(169,155,255,0.12)' : 'transparent', pick: () => { const md = Object.assign({}, s.mode); md[t.id] = k; this.setState({ mode: md }); } })),
        mBuscar: mode === 'buscar', mCriar: mode === 'criar', mTransf: mode === 'transf', mIgnorar: mode === 'ignorar',
        buscaTit: (t.valor > 0 ? 'Parcelas a receber em aberto' : 'Parcelas a pagar em aberto') + '. Selecione uma ou mais.',
        candidatos: cands.map((c, k) => { const on = bsel.includes(k); return { t: c[0], venc: c[1], v: this.money(c[2]), on, border: on ? accent : '#33363E', ring: on ? accent : '#6E727B', fill: on ? accent : 'transparent', toggle: () => { const b = Object.assign({}, s.busca); b[t.id] = on ? bsel.filter((x) => x !== k) : bsel.concat([k]); this.setState({ busca: b }); } }; }),
        difTxt: bsel.length ? (Math.abs(dif) < 0.01 ? 'Soma exata' : dif > 0 ? 'Faltam ' + this.money(dif) + ' para fechar o valor' : 'Passa em ' + this.money(-dif) + ' (vira pagamento parcial)') : 'Nenhuma selecionada', difColor: bsel.length && Math.abs(dif) < 0.01 ? '#6FD3A2' : '#EDB866',
        confBusca: () => { if (!bsel.length) { this.say('Selecione ao menos uma parcela'); return; } markConc([t.id], bsel.map((k) => cands[k][0]).join(' + '), 'Conciliada manualmente com ' + bsel.length + ' parcela(s)'); this.say('Conciliada com ' + bsel.length + (bsel.length === 1 ? ' parcela' : ' parcelas')); },
        confTransf: () => { markConc([t.id], 'Transferência entre contas', 'Marcada como transferência'); this.say('Registrada como transferência'); },
        confIgnorar: () => { this.setState({ tx: s.tx.map((x) => x.id === t.id ? Object.assign({}, x, { status: 'ign', ignReason: 'lançamento duplicado pelo banco' }) : x), opts: null }); this.say('Movimentação ignorada. Pode ser reativada pela ficha'); },
        confCriar: () => { markConc([t.id], 'Lançamento criado na conciliação', 'Título criado na conciliação'); this.say('Lançamento criado e conciliado'); }
      };
    });
    const exatas = pendAll.filter((t) => t.sug && t.sug.exact && (!s.conta || t.conta === s.conta));
    const cq = { pend: String(pendAll.length), pendSub: pendAll.filter((t) => t.valor > 0).length + ' entradas, ' + pendAll.filter((t) => t.valor < 0).length + ' saídas',
      old: pendAll.length ? 'há ' + Math.max(...pendAll.map((t) => (9 * 40 + 17) - (t.m * 40 + t.d))) + ' dias' : '—', oldColor: pendAll.length ? '#EDB866' : '#EEEEF0', oldSub: pendAll.length ? 'Sicoob, rendimento de 01/09' : 'Nada pendente',
      auto: '14', fech: s.bsc.filter((b) => b.ago).length ? s.bsc.filter((b) => b.ago).length + ' pendências' : 'Liberado', fechColor: s.bsc.filter((b) => b.ago).length ? '#EDB866' : '#6FD3A2', fechBorder: s.bsc.filter((b) => b.ago).length ? 'rgba(237,184,102,0.35)' : '#2C2F36', fechSub: s.bsc.filter((b) => b.ago).length ? 'Baixas de agosto sem confirmação' : 'Conciliação de agosto completa',
      hasExatas: exatas.length > 0, exatasTxt: 'Conciliar as ' + exatas.length + ' correspondências exatas' };
    const cDirs = [['todas', 'Todas'], ['entr', 'Entradas'], ['said', 'Saídas']].map(([k, label]) => ({ label, on: s.cDir === k, bg: s.cDir === k ? '#2C2F36' : 'transparent', fg: s.cDir === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ cDir: k }) }));
    const bsc = s.bsc.map((b) => ({ t: b.t, sub: b.sub, dias: b.dias, v: this.money(b.v), procurar: () => { this.setState({ tab: 'extrato', conta: b.sub.includes('Sicoob') ? 'Sicoob' : 'Inter', eq: String(Math.abs(b.v)) }); this.say('Extrato filtrado pelo valor ' + this.money(Math.abs(b.v))); }, confirmar: () => { this.setState({ bsc: s.bsc.filter((x) => x.id !== b.id) }); this.say('Confirmada sem extrato, com justificativa registrada na auditoria'); }, estornar: () => { this.setState({ bsc: s.bsc.filter((x) => x.id !== b.id) }); this.say('Baixa estornada. A parcela voltou a ficar em aberto'); } }));
    const recentes = s.recent.slice().reverse().map((id) => { const t = s.tx.find((x) => x.id === id); return { data: this.dd(t.d) + '/' + this.dd(t.m), vinc: t.vinc, valor: this.money(t.valor), desfazer: () => { const pr = t.sug && t.sug.pair; this.setState({ tx: s.tx.map((x) => x.id === id || x.id === pr ? Object.assign({}, x, { status: 'pend', vinc: '' }) : x), recent: s.recent.filter((r) => r !== id) }); this.say('Conciliação desfeita. A movimentação voltou para a fila'); } }; });

    // FICHAS
    const tt = s.tx.find((t) => t.id === s.txId);
    const tf = tt ? { conta: tt.conta, clean: tt.clean, valor: (tt.valor > 0 ? '+ ' : '− ') + this.money(Math.abs(tt.valor)), valColor: tt.valor > 0 ? '#6FD3A2' : '#EEEEF0', st: tt.status === 'conc' ? 'Conciliada' : tt.status === 'ign' ? 'Ignorada' : 'Pendente de conciliação', stFg: tt.status === 'conc' ? '#6FD3A2' : tt.status === 'ign' ? '#A6A9B1' : '#EDB866', stBg: tt.status === 'conc' ? 'rgba(111,211,162,0.13)' : tt.status === 'ign' ? 'rgba(166,169,177,0.14)' : 'rgba(237,184,102,0.14)', isPend: tt.status === 'pend', isConc: tt.status === 'conc', ignLabel: tt.status === 'ign' ? 'Reativar' : 'Ignorar',
      ignorar: () => { this.setState({ tx: s.tx.map((x) => x.id === tt.id ? Object.assign({}, x, { status: tt.status === 'ign' ? 'pend' : 'ign', ignReason: 'teste' }) : x) }); this.say(tt.status === 'ign' ? 'Movimentação reativada' : 'Ignorada. O motivo fica na auditoria'); },
      desfazer: () => { this.setState({ tx: s.tx.map((x) => x.id === tt.id ? Object.assign({}, x, { status: 'pend', vinc: '', sug: x.sug || { tipo: 'classif', nivel: 'Nada encontrado', titulo: 'Classifique esta movimentação', det: 'A conciliação foi desfeita.', btn: 'Classificar e conciliar', vinc: '' } }) : x), txId: null }); this.say('Conciliação desfeita. Se a conciliação tinha criado um lançamento, o sistema pergunta se ele deve ser estornado'); },
      irConc: () => this.setState({ txId: null, tab: 'conc', opts: null }),
      data: this.dd(tt.d) + '/' + this.dd(tt.m) + '/2026', raw: tt.raw, contra: (tt.raw.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || ['Não informado pelo banco'])[0], idb: (tt.orig === 'Integração' ? 'pay_' : 'FITID ') + (880000 + tt.id * 137), orig: tt.orig === 'OFX' ? 'Importada do extrato OFX' : tt.orig === 'Integração' ? 'Integração Asaas (webhook)' : 'Registrada manualmente',
      vinc: tt.status === 'conc' ? tt.vinc : tt.status === 'ign' ? 'Ignorada, fora do saldo' : 'Nenhum vínculo ainda', vincColor: tt.status === 'conc' ? '#EEEEF0' : '#A6A9B1', how: tt.status === 'conc' ? tt.how : '—' } : {};
    const ca = accts.find((c) => c.id === s.contaId);
    let cf = { cps: [], cfg: [], imports: [], regras: [] };
    if (ca) {
      const pts = []; for (let i = 0; i < 90; i++) { const v = ca.saldo * (0.72 + 0.28 * (i / 89)) + Math.sin(i / 4) * Math.abs(ca.saldo) * 0.08 - (i % 30 > 25 ? Math.abs(ca.saldo) * 0.25 : 0); pts.push(v); }
      pts[89] = ca.saldo; const mx = Math.max(...pts), mn = Math.min(...pts, 0);
      const p = pts.map((v, i) => [(i / 89 * 566 + 1), 8 + 94 * (1 - (v - mn) / ((mx - mn) || 1))]);
      const path = 'M ' + p.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L ');
      const cps = ca.id === 'Sicoob' ? (s.imported ? [['16/09', 'OFX', 'R$ 11.512,40', 'R$ 11.512,40', 'Confere', true]] : [['16/09', 'Manual', 'R$ 11.512,40', 'R$ 11.200,00', 'Diferença de R$ 312,40', false]]).concat([['09/09', 'OFX', 'R$ 11.181,60', 'R$ 11.181,60', 'Confere', true]]) : ca.disp ? [['16/09', ca.id === 'Asaas' ? 'Integração' : 'OFX', this.money(ca.saldo), this.money(ca.saldo), 'Confere', true], ['09/09', ca.id === 'Asaas' ? 'Integração' : 'OFX', this.money(ca.saldo * 0.93), this.money(ca.saldo * 0.93), 'Confere', true]] : [['31/08', 'Manual', this.money(ca.saldo), this.money(ca.saldo), 'Confere', true]];
      const cfgMap = { Banco: [['Banco, agência e conta', ca.id === 'Inter' ? '077, 0001, 4.518.221-3' : '756, 3012, 88.104-5'], ['Compõe o disponível', 'Sim'], ['Confirma por extrato', 'Sim, OFX'], ['Saldo inicial', ca.id === 'Inter' ? 'R$ 42.180,00 em 01/01/2026' : 'R$ 8.400,00 em 01/01/2026'], ['Integração', 'Estrutura pronta, disponível em breve'], ['Conta padrão de', ca.id === 'Inter' ? 'Pagamentos e folha' : 'Recebimentos avulsos']], 'Gateway de pagamento': [['Provedor', 'Asaas'], ['Compõe o disponível', 'Sim'], ['Liquidez', 'D+1 no PIX, D+2 no boleto'], ['Repasse', 'Semanal, toda sexta, para o Inter'], ['Taxas', 'Lançadas automaticamente por cobrança'], ['Saldo inicial', 'R$ 0,00 em 01/01/2026']], 'Reserva, fora do disponível': [['Tipo', 'Reserva e investimento'], ['Compõe o disponível', 'Não'], ['Rendimento', 'Lançado no fim do mês, resultado financeiro'], ['Aplicações e resgates', 'Transferências com o Inter'], ['Reserva mínima de caixa', 'R$ 30.000'], ['Saldo inicial', 'R$ 10.000,00 em 01/01/2026']], 'Cartão de crédito': [['Final', '4471'], ['Fechamento e vencimento', 'Dia 18, vence dia 25'], ['Limite', 'R$ 15.000'], ['Pagamento', 'Transferência do Inter'], ['Compõe o disponível', 'Não'], ['Fatura atual', 'R$ 2.608,03']] };
      cf = { tipo: ca.tipo, nome: ca.nome, saldo: this.money(ca.saldo), saldoColor: ca.saldo < 0 ? '#F08A84' : '#EEEEF0', st: ca.st, stColor: ca.stColor, path, area: path + ' L 567 104 L 1 104 Z',
        cps: cps.map((c) => ({ d: c[0], orig: c[1], banco: c[2], sis: c[3], res: c[4], color: c[5] ? '#6FD3A2' : '#F08A84', border: c[5] ? '#2C2F36' : 'rgba(240,138,132,0.45)' })),
        cfg: (cfgMap[ca.tipo] || []).map((k) => ({ l: k[0], v: k[1] })),
        hasImports: ca.id === 'Inter' || ca.id === 'Sicoob', imports: ca.id === 'Sicoob' ? (s.imported ? [['extrato_sicoob_16-09.ofx', '10/09 a 16/09, 3 novas, 1 duplicada', 'hoje, 09:40', false]] : []).concat([['extrato_sicoob_09-09.ofx', '01/09 a 09/09, 6 novas', '09/09, 18:02', true]]).map((i) => ({ arq: i[0], sub: i[1], quando: i[2], bloq: i[3], op: i[3] ? '0.45' : '1', desfazer: i[3] ? () => {} : () => { this.setState({ imported: false, tx: s.tx.filter((t) => !t.fromImport), contaId: null }); this.say('Importação desfeita: 3 movimentações removidas. Nenhuma tinha conciliação manual'); } })) : [{ arq: 'extrato_inter_16-09.ofx', sub: '10/09 a 16/09, 14 novas, 2 duplicadas', quando: '16/09, 19:15', bloq: true, op: '0.45', desfazer: () => {} }, { arq: 'extrato_inter_09-09.ofx', sub: '01/09 a 09/09, 18 novas', quando: '09/09, 18:00', bloq: true, op: '0.45', desfazer: () => {} }],
        hasRegras: ca.id === 'Inter' || ca.id === 'Sicoob', regras: (ca.id === 'Inter' ? [['POSTO SHELL', 'Transporte, fornecedor Posto Shell', 'usada 4 vezes'], ['TARIFA PACOTE', 'Tarifas bancárias', 'usada 9 vezes'], ['PAG FATURA CARTAO', 'Transferência para o Cartão Inter', 'usada 8 vezes'], ['PIX ENV LOTE', 'Folha, pagamento em lote', 'usada 8 vezes']] : [['RENDIMENTO APLIC', 'Rendimentos', 'usada 8 vezes'], ['TARIFA', 'Tarifas bancárias', 'usada 5 vezes']]).map((r) => ({ p: r[0], c: r[1], n: r[2] })) };
    }

    // IMPORTAÇÃO
    const impLinhas = [['10/09', 'RENDIMENTO APLIC AUTOMATICA', '+ 21,90', 'Nova', '#6FD3A2', '1'], ['08/09', 'PIX RECEB 55.444.333/0001-22 CLINICA BEM VIVER', '+ 3.200,00', 'Já existe', '#A6A9B1', '0.5'], ['15/09', 'TARIFA MANUTENCAO CONTA', '− 9,50', 'Nova', '#6FD3A2', '1'], ['16/09', 'PIX RECEB 76.543.210/0001-98 VIDEOPRO LOCACAO', '+ 300,00', 'Nova', '#6FD3A2', '1']].map((l) => ({ d: l[0], raw: l[1], v: l[2], st: l[3], stColor: l[4], op: l[5] }));
    const impNext = () => {
      if (s.impStep === 1) { if (!s.impArq) { this.say('Escolha o arquivo do extrato'); return; } this.setState({ impStep: 2 }); }
      else if (s.impStep === 2) {
        const add = [
          { id: 101, d: 10, m: 9, conta: 'Sicoob', raw: 'RENDIMENTO APLIC AUTOMATICA', clean: 'Rendimento da aplicação automática', valor: 21.90, status: 'pend', vinc: '', orig: 'OFX', how: '', fromImport: true, sug: { tipo: 'regra', nivel: 'Regra aprendida', titulo: 'Lançar como Rendimento', det: 'Regra "RENDIMENTO APLIC" → Rendimentos, usada 8 vezes.', btn: 'Lançar e conciliar', vinc: 'Rendimento' } },
          { id: 102, d: 15, m: 9, conta: 'Sicoob', raw: 'TARIFA MANUTENCAO CONTA', clean: 'Tarifa de manutenção de conta', valor: -9.50, status: 'pend', vinc: '', orig: 'OFX', how: '', fromImport: true, sug: { tipo: 'regra', nivel: 'Regra aprendida', titulo: 'Lançar como Tarifa bancária', det: 'Regra "TARIFA" → Tarifas bancárias, usada 5 vezes.', btn: 'Lançar e conciliar', vinc: 'Tarifa bancária' } },
          { id: 103, d: 16, m: 9, conta: 'Sicoob', raw: 'PIX RECEB 76.543.210/0001-98 VIDEOPRO LOCACAO', clean: 'PIX recebido de VideoPro Locação', valor: 300, status: 'pend', vinc: '', orig: 'OFX', how: '', fromImport: true, sug: { tipo: 'classif', nivel: 'Nada encontrado', titulo: 'Classifique esta entrada', det: 'VideoPro é fornecedor de locação, não cliente. Pode ser devolução de caução.', btn: 'Classificar e conciliar', vinc: '' } }
        ];
        this.setState({ impStep: 3, imported: true, tx: s.tx.concat(add) });
      } else this.setState({ importOpen: false, impStep: 1, impArq: false, tab: 'conc', conta: 'Sicoob' });
    };

    // MOVIMENTAÇÃO / TRANSFERÊNCIA
    const isT = s.movOpen === 'transf';
    const salvarMov = () => {
      const v = this.parse(s.mf.valor); if (v <= 0) { this.say('Informe o valor'); return; }
      const nid = 200 + s.tx.length;
      if (isT) { if (s.mf.de === s.mf.para) { this.say('Escolha contas diferentes'); return; } this.setState({ tx: s.tx.concat([{ id: nid, d: 17, m: 9, conta: s.mf.de, raw: 'TRANSFERENCIA REGISTRADA', clean: 'Transferência para ' + s.mf.para, valor: -v, status: 'conc', vinc: 'Transferência ' + s.mf.de + ' → ' + s.mf.para, orig: 'Manual', how: 'Registrada manualmente, aguardando extrato' }]), movOpen: null }); this.say('Transferência registrada: ' + this.money(v) + ' de ' + s.mf.de + ' para ' + s.mf.para + '. Sem impacto no resultado' + (s.mf.para === 'Reserva' ? '; sai do disponível' : '')); }
      else { const val = s.mf.tipo === 'saida' ? -v : v; this.setState({ tx: s.tx.concat([{ id: nid, d: 17, m: 9, conta: s.mf.de, raw: 'LANCAMENTO MANUAL', clean: s.mf.desc || s.mf.cat, valor: val, status: 'conc', vinc: s.mf.cat + ' (título criado e liquidado)', orig: 'Manual', how: 'Lançamento direto: título criado já liquidado' }]), movOpen: null }); this.say('Movimentação lançada em ' + s.mf.de + '. O título foi criado já liquidado, para a DRE'); }
    };
    const setMf = (p) => this.setState({ mf: Object.assign({}, s.mf, p) });


    return {
      accent,
      abrirTransf: () => this.setState({ movOpen: 'transf', mf: { de: 'Inter', para: 'Reserva', tipo: 'saida', cat: 'Tarifas bancárias', desc: '', valor: '' } }),
      abrirMov: () => this.setState({ movOpen: 'mov', mf: { de: 'Inter', para: 'Reserva', tipo: 'saida', cat: 'Tarifas bancárias', desc: '', valor: '' } }),
      abrirImport: () => this.setState({ importOpen: true, impStep: s.imported ? 1 : 1, impArq: false }),
      dispTxt: this.money(disp), folegoTxt: 'Cerca de ' + (disp / avgOut).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' meses de fôlego', dispBorder: !s.conta ? accent : '#2C2F36', semFiltro: !s.conta,
      contas, novaConta: nav('Abriria o cadastro de conta: tipo, dados, saldo inicial, se compõe o disponível e se confirma por extrato'),
      contaTodas: () => this.setState({ conta: null }), temFiltro: !!s.conta, filtroNome: acc ? acc.nome : '',
      tabs, tabFluxo: s.tab === 'fluxo', tabExtrato: s.tab === 'extrato', tabConc: s.tab === 'conc',
      fluxoForaDisp: !!foraDisp, fluxoOk: !foraDisp, fluxoForaTxt: acc ? (acc.id === 'Cartão' ? 'O cartão fica fora do disponível. Cada compra é uma despesa na data da compra; o que afeta o caixa é o pagamento da fatura, que aparece no fluxo do disponível como "Faturas de cartão". Para ver as compras, use Pagamentos, modo fatura.' : 'A reserva fica fora do disponível. Aplicações e resgates aparecem no fluxo do disponível como "Entre contas". O rendimento entra na reserva como resultado financeiro.') : '',
      hzs, granTxt: H === 90 ? 'Semanal. 13 semanas antes e depois de hoje' : H === 365 ? 'Mensal. 6 meses antes e 12 depois' : 'Diário. ' + H + ' dias antes e depois de hoje',
      vencOn: s.vencOn, toggleVenc: () => this.setState({ vencOn: !s.vencOn }), vencTrack: s.vencOn ? accent : '#454852', vencKnob: s.vencOn ? '14px' : '2px',
      exportar: nav('Exportaria o fluxo em planilha'), resumo,
      chartTitulo: (acc ? acc.nome + ', ' : 'Disponível, ') + 'realizado e previsto',
      yTicks, g1: g[0] || '-10', g2: g[1] || '-10', g3: g[2] || '-10', resY: Y(30000 * share).toFixed(1), realPath, prevPath, areaPath,
      todayX: todayX.toFixed(1), todayLabelX: (60 + todayX + 4).toFixed(0), minX: pts[minK][0].toFixed(1), minY: Y(minV).toFixed(1), minLabel: 'mín. ' + this.mil(minV) + ' em ' + this.dd(minDt.getDate()) + '/' + this.dd(minDt.getMonth() + 1), minLabelX: Math.min(60 + 1014 - 150, 60 + pts[minK][0] + 8).toFixed(0), minLabelY: (Y(minV) + 6).toFixed(0),
      bars, barGap: N > 70 ? 1 : 2, xLabels, clearHover: () => this.setState({ hover: -1 }), hasHov: !!hv, hovX: hv ? pts[s.hover][0].toFixed(1) : '-10', hovOp: hv ? '0.4' : '0', tip, tipLeft: hv ? String(Math.max(0, Math.min(1084 - 236, 60 + pts[s.hover][0] - 115))) : '0',
      chartNota: 'Realizado em cor sólida, previsto em contorno. ' + (s.vencOn ? 'Recebimentos vencidos incluídos como entrada amanhã (R$ 8.450).' : 'Recebimentos vencidos fora da projeção (R$ 8.450).') + ' Clique numa barra para ver os lançamentos.',
      compare: s.compare, toggleCompare: () => this.setState({ compare: !s.compare }), cmpTrack: s.compare ? accent : '#454852', cmpKnob: s.compare ? '14px' : '2px',
      tblHead, tblRows, tblCols, tblMinW: String(tblMinW),
      cellOpen: !!s.cell, cell, closeCell: () => this.setState({ cell: null }),
      eq: s.eq, onEq: (e) => this.setState({ eq: e.target.value }), eTipos, eStatus: s.eStatus, onEStatus: (e) => this.setState({ eStatus: e.target.value }), eOrig: s.eOrig, onEOrig: (e) => this.setState({ eOrig: e.target.value }),
      semContaExtrato: !single, saldoColLabel: single ? 'Saldo' : '', eDias, eVazio: extr.length === 0, eCount: extr.length + (extr.length === 1 ? ' movimentação' : ' movimentações'), eEntr: this.money0(extr.filter((t) => t.valor > 0 && t.status !== 'ign').reduce((a, t) => a + t.valor, 0)), eSaid: this.money0(-extr.filter((t) => t.valor < 0 && t.status !== 'ign').reduce((a, t) => a + t.valor, 0)),
      cq, cDirs, fila, filaVazia: fila.length === 0,
      conciliarExatas: () => { const ids = exatas.map((t) => t.id); this.setState({ tx: s.tx.map((t) => ids.includes(t.id) ? Object.assign({}, t, { status: 'conc', vinc: t.sug.vinc, how: 'Conciliação em lote de correspondências exatas' }) : t), recent: s.recent.concat(ids) }); this.say(ids.length + ' correspondências exatas conciliadas de uma vez'); },
      bsc, bscVazio: s.bsc.length === 0, temRecentes: s.recent.length > 0, recentes,
      txOpen: !!tt, tf, closeTx: () => this.setState({ txId: null }),
      contaOpen: !!ca, cf, closeConta: () => this.setState({ contaId: null }), cpFormOpen: s.cpFormOpen, toggleCpForm: () => this.setState({ cpFormOpen: !s.cpFormOpen }), cpValor: s.cpValor, onCpValor: (e) => this.setState({ cpValor: e.target.value }),
      salvarCp: () => { const v = this.parse(s.cpValor); if (!v) { this.say('Informe o saldo do banco'); return; } const dif = v - (ca ? ca.saldo : 0); this.setState({ cpFormOpen: false, cpValor: '' }); this.say(Math.abs(dif) < 0.01 ? 'Saldo confere com o sistema' : 'Diferença de ' + this.money(Math.abs(dif)) + ' registrada. O alerta fica ativo até ser resolvida'); },
      importOpen: s.importOpen, closeImport: () => this.setState({ importOpen: false, impStep: 1, impArq: false }), impStep: String(s.impStep),
      impSteps: [['Conta e arquivo', 1], ['Prévia e conferência', 2], ['Resultado', 3]].map(([t, n]) => ({ t, bar: s.impStep >= n ? accent : '#33363E', fg: s.impStep >= n ? '#EEEEF0' : '#A6A9B1' })),
      imp1: s.impStep === 1, imp2: s.impStep === 2, imp3: s.impStep === 3, escolherArq: () => this.setState({ impArq: true }),
      arqTxt: s.impArq ? 'extrato_sicoob_16-09.ofx selecionado' : 'Arraste o arquivo ou clique para escolher', arqBorder: s.impArq ? accent : '#454852', arqBg: s.impArq ? 'rgba(169,155,255,0.07)' : 'transparent', arqFg: s.impArq ? '#EEEEF0' : '#A6A9B1',
      impLinhas, impNext, impNextLabel: s.impStep === 1 ? 'Continuar' : s.impStep === 2 ? 'Importar 3 movimentações' : 'Ir para a conciliação', impNextBg: s.impStep === 1 && !s.impArq ? '#5A5480' : accent, impCancel: s.impStep === 3 ? 'Fechar' : 'Cancelar',
      movOpen: !!s.movOpen, isTransf: isT, isMov: !isT, movTitulo: isT ? 'Nova transferência' : 'Nova movimentação', movSub: isT ? 'Entre contas da Viofilme. Não afeta o resultado.' : 'Para o que não tem conta a pagar ou a receber: tarifa, rendimento, gasto pago na hora.', movBtn: isT ? 'Registrar transferência' : 'Lançar movimentação',
      movNota: isT ? (s.mf.para === 'Reserva' ? 'Aplicação na reserva: sai do disponível e aparece em "Entre contas" no fluxo.' : s.mf.para === 'Cartão Inter' ? 'Pagamento de fatura: é transferência, porque as compras já entraram como despesa.' : 'Com extrato, os dois lados serão confirmados na conciliação.') : 'O sistema cria o título já liquidado, para que a movimentação apareça na DRE pela categoria.',
      mf: s.mf, onMfDe: (e) => setMf({ de: e.target.value }), onMfPara: (e) => setMf({ para: e.target.value }), onMfTipo: (e) => setMf({ tipo: e.target.value }), onMfCat: (e) => setMf({ cat: e.target.value }), onMfDesc: (e) => setMf({ desc: e.target.value }), onMfValor: (e) => setMf({ valor: e.target.value }), closeMov: () => this.setState({ movOpen: null }), salvarMov,
      hasToast: !!s.toast, toast: s.toast || ''
    };
  }
}
