/*
MOCKUP — Recebimentos (Financeiro Viofilme) · FONTE LEGÍVEL · ARQUIVO 3 de 3
Lógica do mockup: estado, DADOS DE EXEMPLO (fictícios, mas coerentes entre si; use como exemplo de cálculo),
derivações e handlers. Os bindings {{ ... }} de mockup_recebimentos_1_pagina.html e mockup_recebimentos_2_paineis.html vêm daqui
(principalmente de renderVals()). DCLogic é a classe base do runtime do Claude Design (setState, props).
Props do componente: {"accent":{"editor":"color","default":"#A99BFF","options":["#A99BFF","#F2A97E","#9ADFB5","#E8D27A"]},"$preview":{"width":1440,"height":1500}}
*/
class Component extends DCLogic {
  constructor(...a) {
    super(...a);
    const P = (o) => Object.assign({ m: 9, pago: 0, cob: 'none', origem: 'rec', parc: null, conta: 'Asaas', recebidoEm: null, conc: false, nf: null, baixas: [], cobInfo: '' }, o);
    this.state = {
      tab: 'contas', view: 'aberto', base: 'venc', mes: 9, q: '', semCob: false, sel: [], qCli: '',
      fichaId: null, wide: false, cliNome: null, recId: null, novaOpen: false, baixaId: null,
      bForm: { data: '2026-09-17', valor: '', conta: 'Asaas', dispensa: false, motivo: 'Acordo com cliente', modo: 'manter', cancelCob: true },
      aging: null, inadOpen: 'Atlas Engenharia', promFor: null, promData: '2026-09-25', promises: {}, whatsSent: {}, toast: null,
      nf: this.nfInit(''),
      parcels: [
        P({ id: 1, cli: 'Clínica Vitta', desc: 'Mensalidade Set/26', d: 17, valor: 4800, cob: 'viewed', cobSent: '12/09', cobView: '15/09', itens: [['Social Media', 3200], ['Tráfego pago', 1600]] }),
        P({ id: 2, cli: 'Grupo Orla', desc: 'Vídeo institucional', d: 21, valor: 6000, origem: 'proj', parc: [2, 3], projeto: 'Vídeo institucional 2026', itens: [['Audiovisual', 6000]] }),
        P({ id: 3, cli: 'BNEX', desc: 'Mensalidade Set/26', d: 22, valor: 3300, itens: [['Social Media', 3300]] }),
        P({ id: 4, cli: 'APTO', desc: 'Mensalidade Set/26', d: 24, valor: 4500, cob: 'sent', cobSent: '17/09', itens: [['Social Media', 3000], ['Tráfego pago', 1500]] }),
        P({ id: 5, cli: 'Restaurante Sabor do Mar', desc: 'Mensalidade Set/26', d: 25, valor: 7800, cob: 'scheduled', cobInfo: '20/09', itens: [['Social Media', 4200], ['Audiovisual', 3600]] }),
        P({ id: 6, cli: 'Ótica Visão Clara', desc: 'Mensalidade Set/26', d: 28, valor: 2900, cob: 'scheduled', cobInfo: '23/09', itens: [['Social Media', 2900]] }),
        P({ id: 7, cli: 'Padaria Trigo Fino', desc: 'Gestão de tráfego Set/26', d: 30, valor: 1800, cob: 'scheduled', cobInfo: '25/09', itens: [['Tráfego pago', 1800]] }),
        P({ id: 8, cli: 'Construtora Horizonte', desc: 'Campanha de lançamento', d: 20, valor: 9000, pago: 4000, cob: 'sent', cobSent: '15/09', origem: 'proj', parc: [1, 2], projeto: 'Campanha de lançamento', itens: [['Audiovisual', 9000]], baixas: [{ data: '12/09', desc: 'Sinal via PIX, conta Inter', val: 4000, conc: true }] }),
        P({ id: 9, cli: 'Atlas Engenharia', desc: 'Mensalidade Set/26', d: 5, valor: 5300, cob: 'viewed', cobSent: '31/08', cobView: '06/09', itens: [['Social Media', 3500], ['Tráfego pago', 1800]] }),
        P({ id: 10, cli: 'Estúdio Brisa', desc: 'Mensalidade Set/26', d: 12, valor: 1650, cob: 'sent', cobSent: '07/09', itens: [['Social Media', 1650]] }),
        P({ id: 11, cli: 'Nuvem Pet', desc: 'Mensalidade Set/26', d: 14, valor: 1500, cob: 'viewed', cobSent: '09/09', cobView: '14/09', itens: [['Tráfego pago', 1500]] }),
        P({ id: 12, cli: 'Casa Nómade', desc: 'Mensalidade Set/26', d: 10, valor: 2600, pago: 2600, cob: 'viewed', cobSent: '05/09', recebidoEm: '16/09', nf: 'NF 1279', itens: [['Social Media', 2600]], baixas: [{ data: '16/09', desc: 'PIX via Asaas, com R$ 57,20 de multa e juros', val: 2657.2, conc: false }] }),
        P({ id: 13, cli: 'Mar Azul Pousada', desc: 'Mensalidade Set/26', d: 5, valor: 3900, pago: 3900, cob: 'viewed', cobSent: '31/08', recebidoEm: '05/09', conc: true, nf: 'NF 1271', itens: [['Social Media', 2400], ['Tráfego pago', 1500]], baixas: [{ data: '05/09', desc: 'Boleto via Asaas', val: 3900, conc: true }] }),
        P({ id: 14, cli: 'Studio Pilates Ápice', desc: 'Mensalidade Set/26', d: 8, valor: 2200, pago: 2200, cob: 'viewed', cobSent: '03/09', recebidoEm: '08/09', conc: true, nf: 'NF 1273', itens: [['Social Media', 2200]], baixas: [{ data: '08/09', desc: 'PIX via Asaas', val: 2200, conc: true }] }),
        P({ id: 15, cli: 'Café Aroma', desc: 'Mensalidade Set/26', d: 10, valor: 3100, pago: 3100, cob: 'viewed', cobSent: '05/09', recebidoEm: '11/09', conc: true, itens: [['Social Media', 3100]], baixas: [{ data: '11/09', desc: 'PIX via Asaas', val: 3100, conc: true }] }),
        P({ id: 16, cli: 'Imobiliária Costa Norte', desc: 'Mensalidade Set/26', d: 15, valor: 6200, pago: 6200, cob: 'viewed', cobSent: '10/09', recebidoEm: '15/09', conta: 'Inter', itens: [['Social Media', 3700], ['Tráfego pago', 2500]], baixas: [{ data: '15/09', desc: 'Transferência, conta Inter (registrada manualmente)', val: 6200, conc: false }] })
      ]
    };
  }
  nfInit(cli) {
    return { tipo: 'unica', cli: cli, desc: '', descTouched: false, itens: [{ serv: 'Social Media', val: '' }], venc: '2026-10-05', nParc: '3', primVenc: '2026-10-10', compMode: 'cada', inicio: '2026-10-01', dia: '5', compRef: 'mesmo', termino: 'sem', reaj: 'nenhum', forma: 'Asaas, PIX e boleto', envio: true, mais: false, novoCli: false, cnpj: '', cnpjOk: false, novoCliNome: null };
  }
  money(n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  money0(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }
  parse(s) { if (typeof s === 'number') return s; const v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(v) ? 0 : v; }
  say(msg) { this.setState({ toast: msg }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 3400); }
  componentWillUnmount() { clearTimeout(this._t); }
  mesNome(m) { return ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][m - 1]; }
  dd(n) { return String(n).padStart(2, '0'); }
  pd(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  fd(d) { return this.dd(d.getDate()) + '/' + this.dd(d.getMonth() + 1) + '/' + d.getFullYear(); }
  addM(d, n, day) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day || d.getDate(), last)); return x; }
  compOf(d) { const n = this.mesNome(d.getMonth() + 1); return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + d.getFullYear(); }
  clients() {
    const base = [
      ['APTO', 4500, ['Social Media', 'Tráfego pago'], 54000, '1,2 dia', 'Pontual', 'mar/2025', null, 24, 'Renata Alves'],
      ['Atlas Engenharia', 5300, ['Social Media', 'Tráfego pago'], 58300, '9,8 dias', 'Atrasa com frequência', 'jan/2025', null, 5, 'Marcos Tavares'],
      ['BNEX', 3300, ['Social Media'], 39600, '2,1 dias', 'Pontual', 'fev/2024', null, 22, 'Juliana Prado'],
      ['Café Aroma', 3100, ['Social Media'], 34100, '1,4 dia', 'Pontual', 'out/2025', null, 10, 'Pedro Lins'],
      ['Casa Nómade', 2600, ['Social Media'], 31200, '5,6 dias', 'Atrasa às vezes', 'jun/2024', null, 10, 'Laura Nunes'],
      ['Clínica Vitta', 4800, ['Social Media', 'Tráfego pago'], 55200, '0,4 dia', 'Pontual', 'mai/2024', null, 17, 'Dra. Helena Rocha'],
      ['Construtora Horizonte', 0, ['Audiovisual'], 4000, '—', 'Pontual', 'set/2026', null, 20, 'Rafael Couto'],
      ['Estúdio Brisa', 1650, ['Social Media'], 19800, '4,3 dias', 'Atrasa às vezes', 'nov/2024', null, 12, 'Bia Santos'],
      ['Grupo Orla', 0, ['Audiovisual'], 6000, '0 dia', 'Pontual', 'ago/2026', null, 21, 'Fernando Orla'],
      ['Imobiliária Costa Norte', 6200, ['Social Media', 'Tráfego pago'], 74400, '0,8 dia', 'Pontual', 'jan/2024', null, 15, 'Cláudia Reis'],
      ['Mar Azul Pousada', 3900, ['Social Media', 'Tráfego pago'], 42900, '0 dia', 'Pontual', 'abr/2025', null, 5, 'Tiago Mar'],
      ['Nuvem Pet', 1500, ['Tráfego pago'], 16500, '1,9 dia', 'Pontual', 'set/2025', 'Falta CNPJ', 14, 'Ana Clara'],
      ['Ótica Visão Clara', 2900, ['Social Media'], 31900, '2,6 dias', 'Pontual', 'jul/2025', null, 28, 'Sérgio Vidal'],
      ['Padaria Trigo Fino', 1800, ['Tráfego pago'], 19800, '3,1 dias', 'Atrasa às vezes', 'ago/2025', 'Falta endereço', 30, 'Dona Rosa'],
      ['Restaurante Sabor do Mar', 7800, ['Social Media', 'Audiovisual'], 85800, '1,0 dia', 'Pontual', 'mar/2024', null, 25, 'Chef André'],
      ['Studio Pilates Ápice', 2200, ['Social Media'], 24200, '0,5 dia', 'Pontual', 'fev/2025', null, 8, 'Carla Mota']
    ];
    return base.map((b, i) => ({ nome: b[0], mrr: b[1], servs: b[2], rec12: b[3], atraso: b[4], perfil: b[5], desde: b[6], inc: b[7], dia: b[8], contato: b[9], idx: i }));
  }
  perfTone(p) { if (p === 'Pontual') return ['#6FD3A2', 'rgba(111,211,162,0.13)']; if (p === 'Atrasa às vezes') return ['#EDB866', 'rgba(237,184,102,0.14)']; return ['#F08A84', 'rgba(240,138,132,0.14)']; }
  cat(serv, tipo) { if (tipo === 'rec') return 'Receita › Mensalidades'; if (serv === 'Audiovisual' || serv === 'Projetos e consultoria') return 'Receita › Projetos'; return 'Receita › Serviços avulsos'; }
  derive(p) {
    const saldo = Math.max(0, p.valor - p.pago);
    const settled = saldo < 0.01;
    const diff = (p.m - 9) * 30 + p.d - 17;
    const overdue = !settled && diff < 0;
    const dias = overdue ? -diff : 0;
    let chip, fg, bg, rel, relColor = '#A6A9B1';
    if (settled) { chip = 'Recebida'; fg = '#6FD3A2'; bg = 'rgba(111,211,162,0.13)'; rel = 'Paga em ' + p.recebidoEm; }
    else if (overdue) { chip = (p.pago > 0 ? 'Parcial, vencida há ' : 'Vencida há ') + dias + (dias === 1 ? ' dia' : ' dias'); fg = '#F08A84'; bg = 'rgba(240,138,132,0.14)'; rel = 'há ' + dias + (dias === 1 ? ' dia' : ' dias'); relColor = '#F08A84'; }
    else if (p.pago > 0) { chip = 'Parcial'; fg = '#EDB866'; bg = 'rgba(237,184,102,0.14)'; rel = diff === 0 ? 'vence hoje' : 'em ' + diff + ' dias'; relColor = diff <= 7 ? '#86B4F7' : '#A6A9B1'; }
    else if (diff === 0) { chip = 'Vence hoje'; fg = '#EDB866'; bg = 'rgba(237,184,102,0.14)'; rel = 'hoje'; relColor = '#EDB866'; }
    else if (diff <= 7) { chip = 'Vence em ' + diff + (diff === 1 ? ' dia' : ' dias'); fg = '#86B4F7'; bg = 'rgba(134,180,247,0.13)'; rel = 'em ' + diff + ' dias'; relColor = '#86B4F7'; }
    else { chip = 'A vencer'; fg = '#C9CBD1'; bg = 'rgba(166,169,177,0.14)'; rel = 'em ' + diff + ' dias'; }
    let cobTxt, cobFg;
    if (settled) { cobTxt = p.conc ? 'Confirmada no extrato' : 'Aguardando extrato'; cobFg = p.conc ? '#6FD3A2' : '#A6A9B1'; }
    else if (p.cob === 'none') { cobTxt = 'Sem cobrança'; cobFg = '#EDB866'; }
    else if (p.cob === 'scheduled') { cobTxt = 'Envio automático em ' + p.cobInfo; cobFg = '#A6A9B1'; }
    else if (p.cob === 'sent') { cobTxt = 'Cobrança enviada em ' + p.cobSent; cobFg = '#86B4F7'; }
    else { cobTxt = 'Visualizada pelo cliente'; cobFg = '#6FD3A2'; }
    const enc = overdue ? saldo * 0.02 + saldo * 0.01 * dias / 30 : 0;
    return { saldo, settled, overdue, dias, diff, chip, fg, bg, rel, relColor, cobTxt, cobFg, enc };
  }
  setNf(patch) { this.setState({ nf: Object.assign({}, this.state.nf, patch) }); }
  setB(patch) { this.setState({ bForm: Object.assign({}, this.state.bForm, patch) }); }
  abrirBaixa(p) {
    const dv = this.derive(p);
    this.setState({ baixaId: p.id, bForm: { data: '2026-09-17', valor: (dv.saldo + dv.enc).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), conta: p.conta, dispensa: false, motivo: 'Acordo com cliente', modo: 'manter', cancelCob: true } });
  }
  enviarCob(ids) {
    const n = this.state.parcels.map((p) => ids.includes(p.id) && p.cob !== 'sent' && p.cob !== 'viewed' && p.valor - p.pago > 0 ? Object.assign({}, p, { cob: 'sent', cobSent: '17/09' }) : p);
    this.setState({ parcels: n });
  }
  renderVals() {
    const s = this.state;
    const accent = this.props.accent ?? '#A99BFF';
    const today = 17;
    const P = s.parcels.map((p) => Object.assign({}, p, { dv: this.derive(p) }));
    const month = P.filter((p) => p.m === s.mes);
    const mesNome = this.mesNome(s.mes);
    const mesLabel = mesNome.charAt(0).toUpperCase() + mesNome.slice(1) + ' 2026';

    const aVencer = month.filter((p) => !p.dv.settled && !p.dv.overdue);
    const semCobAll = month.filter((p) => !p.dv.settled && p.cob === 'none');
    const overdueAll = P.filter((p) => p.dv.overdue);
    const vencTot = overdueAll.reduce((a, p) => a + p.dv.saldo, 0);
    const vencClis = Array.from(new Set(overdueAll.map((p) => p.cli)));
    const maxDias = overdueAll.reduce((a, p) => Math.max(a, p.dv.dias), 0);
    const monthTotal = month.reduce((a, p) => a + p.valor, 0);
    const monthPago = month.reduce((a, p) => a + Math.min(p.pago, p.valor), 0);

    const matchesView = (p, v) => {
      if (v === 'aberto') return !p.dv.settled;
      if (v === 'vencidas') return p.dv.overdue;
      if (v === 'recebidas') return p.dv.settled || p.pago > 0;
      return true;
    };
    const ql = s.q.trim().toLowerCase();
    let list = month.filter((p) => matchesView(p, s.view)).filter((p) => !s.semCob || (!p.dv.settled && p.cob === 'none')).filter((p) => !ql || p.cli.toLowerCase().includes(ql) || p.desc.toLowerCase().includes(ql) || String(Math.round(p.valor)).includes(ql.replace(/\D/g, '') || '§'));
    list = list.sort((a, b) => (b.dv.overdue - a.dv.overdue) || (a.dv.diff - b.dv.diff));
    const viewCount = (v) => month.filter((p) => matchesView(p, v)).length;
    const views = [['aberto', 'Em aberto'], ['vencidas', 'Vencidas'], ['recebidas', 'Recebidas'], ['todas', 'Todas']].map(([k, label]) => ({ label, count: String(viewCount(k)), on: s.view === k, bg: s.view === k ? '#2C2F36' : 'transparent', fg: s.view === k ? '#EEEEF0' : '#A6A9B1', countFg: k === 'vencidas' && s.view !== k ? '#F08A84' : '#A6A9B1', pick: () => this.setState({ view: k, sel: [] }) }));
    const bases = [['venc', 'Vencimento'], ['comp', 'Competência']].map(([k, label]) => ({ label, on: s.base === k, bg: s.base === k ? '#2C2F36' : 'transparent', fg: s.base === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ base: k }) }));

    const rows = list.map((p) => {
      const dv = p.dv; const sel = s.sel.includes(p.id);
      let subVal = '', subValColor = '#A6A9B1';
      if (dv.settled) subVal = 'recebido em ' + p.recebidoEm;
      else if (dv.overdue) { subVal = this.money(dv.saldo + dv.enc) + ' atualizado'; subValColor = '#EDB866'; }
      else if (p.pago > 0) subVal = 'de ' + this.money(p.valor);
      const semCob = !dv.settled && p.cob === 'none';
      return {
        sel, toggle: () => this.setState({ sel: sel ? s.sel.filter((x) => x !== p.id) : s.sel.concat([p.id]) }),
        rowBg: sel ? 'rgba(169,155,255,0.07)' : 'transparent',
        vencTxt: this.dd(p.d) + '/' + this.dd(p.m), rel: dv.rel, relColor: dv.relColor,
        cli: p.cli, desc: p.desc, isRec: p.origem === 'rec', hasParc: !!p.parc, parcTxt: p.parc ? p.parc[0] + '/' + p.parc[1] : '',
        chip: dv.chip, chipFg: dv.fg, chipBg: dv.bg, cobTxt: dv.cobTxt, cobFg: dv.cobFg,
        valTxt: this.money(dv.settled ? p.valor : dv.saldo), subVal, subValColor,
        actLabel: dv.settled ? 'Comprovante' : (semCob ? 'Enviar cobrança' : 'Registrar'),
        act: dv.settled ? () => this.say('Abriria o comprovante do recebimento') : (semCob ? () => { this.enviarCob([p.id]); this.say('Cobrança enviada para ' + p.cli + ' via Asaas'); } : () => this.abrirBaixa(p)),
        more: () => this.say('Menu: alterar vencimento, reemitir, copiar link, lembrete, duplicar, renegociar, cancelar'),
        open: () => this.setState({ fichaId: p.id }),
        openCli: () => this.setState({ cliNome: p.cli })
      };
    });
    const sumL = (f) => list.reduce((a, p) => a + f(p), 0);
    const selP = P.filter((p) => s.sel.includes(p.id));

    const tabDefs = [['contas', 'Contas a receber', null], ['rec', 'Recorrências', null], ['inad', 'Inadimplência', vencClis.length ? String(vencClis.length) : null], ['cli', 'Clientes', null]];
    const tabs = tabDefs.map(([k, label, badge]) => ({ label, on: s.tab === k, fg: s.tab === k ? '#EEEEF0' : '#A6A9B1', fw: s.tab === k ? '600' : '500', line: s.tab === k ? accent : 'transparent', hasBadge: !!badge, badge: badge || '', badgeBg: 'rgba(240,138,132,0.14)', badgeFg: '#F08A84', pick: () => this.setState({ tab: k, sel: [] }) }));

    const recs = [
      ['APTO', ['Social Media', 'Tráfego pago'], 4500, '+ R$ 500 em ago', 24, 'Desde mar/2025', 'IPCA em 01/10', 'Ativa'],
      ['Restaurante Sabor do Mar', ['Social Media', 'Audiovisual'], 7800, '', 25, 'Desde mar/2024', 'Março', 'Ativa'],
      ['Imobiliária Costa Norte', ['Social Media', 'Tráfego pago'], 6200, '', 15, 'Desde jan/2024', 'Janeiro', 'Ativa'],
      ['Atlas Engenharia', ['Social Media', 'Tráfego pago'], 5300, '', 5, 'Desde jan/2025', 'Janeiro', 'Ativa'],
      ['Clínica Vitta', ['Social Media', 'Tráfego pago'], 4800, '', 17, 'Desde mai/2024', 'IPCA em 15/10', 'Ativa'],
      ['Mar Azul Pousada', ['Social Media', 'Tráfego pago'], 3900, '+ R$ 1.500 em jul', 5, 'Desde abr/2025', 'Abril', 'Ativa'],
      ['BNEX', ['Social Media'], 3300, '', 22, 'Desde fev/2024', 'Fevereiro', 'Ativa'],
      ['Café Aroma', ['Social Media'], 3100, '', 10, 'Desde out/2025', 'Outubro', 'Ativa'],
      ['Ótica Visão Clara', ['Social Media'], 2900, '', 28, 'Desde jul/2025', 'Julho', 'Ativa'],
      ['Casa Nómade', ['Social Media'], 2600, '', 10, 'Desde jun/2024', 'Junho', 'Ativa'],
      ['Studio Pilates Ápice', ['Social Media'], 2200, '', 8, 'Desde fev/2025', 'Fevereiro', 'Ativa'],
      ['Padaria Trigo Fino', ['Tráfego pago'], 1800, '', 30, 'Até dez/2026', '—', 'Ativa'],
      ['Estúdio Brisa', ['Social Media'], 1650, '', 12, 'Desde nov/2024', 'Novembro', 'Ativa'],
      ['Nuvem Pet', ['Tráfego pago'], 1500, '', 14, 'Desde set/2025', 'Setembro', 'Ativa'],
      ['Floricultura Jardim', ['Social Media'], 1200, '', 10, 'Pausada até 01/11', '—', 'Pausada']
    ];
    const recRows = recs.map((r, i) => {
      const paus = r[7] === 'Pausada';
      const pr = P.find((p) => p.cli === r[0] && p.origem === 'rec');
      let prox = paus ? 'Retoma em 01/11' : '05/10, será gerada';
      if (pr && !pr.dv.settled) prox = this.dd(pr.d) + '/09 · ' + (pr.dv.overdue ? 'vencida' : pr.cob === 'none' ? 'sem cobrança' : pr.cob === 'scheduled' ? 'envio ' + pr.cobInfo : 'enviada');
      else if (pr) prox = this.dd(r[4]) + '/10 · gerada';
      return { cli: r[0], servs: r[1].map((n) => ({ n })), valTxt: this.money0(r[2]), delta: r[3], dia: String(r[4]), vig: r[5], reaj: r[6], reajColor: r[6].startsWith('IPCA') ? '#EDB866' : '#A6A9B1', status: r[7], prox, stFg: paus ? '#EDB866' : '#6FD3A2', stBg: paus ? 'rgba(237,184,102,0.14)' : 'rgba(111,211,162,0.13)', open: () => this.setState({ recId: i }) };
    });
    const mrr = recs.filter((r) => r[7] === 'Ativa').reduce((a, r) => a + r[2], 0);

    const faixas = [['1–7 dias', 1, 7], ['8–15 dias', 8, 15], ['16–30 dias', 16, 30], ['31–60 dias', 31, 60], ['60+ dias', 61, 9999]];
    const agVals = faixas.map((f) => overdueAll.filter((p) => p.dv.dias >= f[1] && p.dv.dias <= f[2]));
    const agMax = Math.max(1, ...agVals.map((a) => a.reduce((x, p) => x + p.dv.saldo, 0)));
    const aging = faixas.map((f, i) => {
      const v = agVals[i].reduce((x, p) => x + p.dv.saldo, 0); const on = s.aging === i;
      const nC = new Set(agVals[i].map((p) => p.cli)).size;
      return { label: f[0], v: v ? this.money0(v) : '—', vColor: v ? '#EEEEF0' : '#6E727B', h: String(v ? Math.max(8, Math.round(v / agMax * 58)) : 3), bar: v ? '#F08A84' : '#33363E', n: nC ? nC + (nC === 1 ? ' cliente' : ' clientes') : 'nenhum', on, border: on ? '#F08A84' : '#2C2F36', bgBtn: on ? 'rgba(240,138,132,0.08)' : '#191B1F', pick: () => this.setState({ aging: on ? null : i }) };
    });
    const info = {
      'Atlas Engenharia': { cs: 'Bruna', perfil: 'Atrasa com frequência', ultimo: 'Ligação em 15/09: pediu 2ª via', tl: [['15/09', 'Ligação registrada por Iago: cliente pediu 2ª via do boleto'], ['08/09', 'E-mail de atraso enviado automaticamente (D+3)'], ['05/09', 'Lembrete no dia do vencimento (D+0)'], ['31/08', 'Cobrança enviada automaticamente (D−5)']] },
      'Estúdio Brisa': { cs: 'Bruna', perfil: 'Atrasa às vezes', ultimo: 'E-mail automático em 15/09', tl: [['15/09', 'E-mail de atraso enviado automaticamente (D+3)'], ['12/09', 'Lembrete no dia do vencimento (D+0)'], ['07/09', 'Cobrança enviada automaticamente (D−5)']] },
      'Nuvem Pet': { cs: 'Bruna', perfil: 'Pontual', ultimo: 'E-mail automático hoje', tl: [['17/09', 'E-mail de atraso enviado automaticamente (D+3)'], ['14/09', 'Lembrete no dia do vencimento (D+0)'], ['09/09', 'Cobrança enviada automaticamente (D−5)']] }
    };
    const stageOf = (d) => d >= 30 ? 5 : d >= 20 ? 4 : d >= 10 ? 3 : d >= 3 ? 2 : 1;
    let inadList = vencClis.map((cli) => {
      const ps = overdueAll.filter((p) => p.cli === cli); const dias = Math.max(...ps.map((p) => p.dv.dias));
      return { cli, ps, dias, tot: ps.reduce((a, p) => a + p.dv.saldo, 0), totAt: ps.reduce((a, p) => a + p.dv.saldo + p.dv.enc, 0) };
    }).sort((a, b) => b.dias - a.dias);
    if (s.aging !== null) inadList = inadList.filter((c) => c.ps.some((p) => p.dv.dias >= faixas[s.aging][1] && p.dv.dias <= faixas[s.aging][2]));
    const stageCount = [0, 0, 0, 0, 0, 0];
    vencClis.forEach((cli) => { if (s.promises[cli]) return; const d = Math.max(...overdueAll.filter((p) => p.cli === cli).map((p) => p.dv.dias)); stageCount[stageOf(d)]++; });
    const reguaDef = [['D−5', 'Envio da cobrança', 'Automático, e-mail'], ['D+0', 'Lembrete no vencimento', 'Automático, e-mail'], ['D+3', 'Aviso de atraso', 'Automático, e-mail'], ['D+10', 'WhatsApp', 'Manual até a integração'], ['D+20', 'CS acionado', 'Automático, notificação'], ['D+30', 'Diretoria', 'Tarefa para Iago']];
    const regua = reguaDef.map((r, i) => {
      const c = i === 0 ? semCobAll.length + aVencer.filter((p) => p.cob === 'scheduled').length : stageCount[i];
      const hot = c > 0 && i > 0;
      return { dia: r[0], acao: r[1], modo: r[2], count: i === 0 ? c + ' esta semana' : c ? c + (c === 1 ? ' cliente' : ' clientes') : 'nenhum', countFg: hot ? '#EDB866' : '#A6A9B1', fg: hot ? '#EDB866' : '#A6A9B1', bg: hot ? 'rgba(237,184,102,0.06)' : '#191B1F', border: hot ? 'rgba(237,184,102,0.3)' : '#2C2F36' };
    });
    const inadRows = inadList.map((c) => {
      const inf = info[c.cli] || { cs: 'Bruna', perfil: 'Pontual', ultimo: '—', tl: [] };
      const prom = s.promises[c.cli]; const wSent = s.whatsSent[c.cli]; const open = s.inadOpen === c.cli;
      const st = stageOf(c.dias);
      let etapa = reguaDef[st][0] + ', ' + reguaDef[st][1].toLowerCase(); let prox = '';
      let etapaFg = '#EEEEF0';
      if (st === 3) { etapa = wSent ? 'D+10, WhatsApp enviado' : 'D+10, WhatsApp pendente'; etapaFg = wSent ? '#EEEEF0' : '#EDB866'; prox = 'Próximo: acionar CS em ' + this.dd(c.dias <= 20 ? 17 + (20 - c.dias) : 17) + '/09'; }
      else if (st === 2) { etapa = 'D+3, aviso de atraso enviado'; prox = 'Próximo: WhatsApp em ' + this.dd(17 + (10 - c.dias)) + '/09'; }
      let ultimo = inf.ultimo;
      if (prom) { etapa = 'Régua pausada'; etapaFg = '#86B4F7'; prox = 'Promessa de pagamento para ' + prom.data; ultimo = 'Promessa registrada hoje'; }
      else if (wSent) ultimo = 'WhatsApp enviado hoje';
      const tl = [];
      if (prom) tl.push({ d: '17/09', t: 'Promessa de pagamento registrada para ' + prom.data + ' (' + this.money(c.totAt) + '). Régua pausada.', dot: '#86B4F7' });
      if (wSent) tl.push({ d: '17/09', t: 'WhatsApp enviado manualmente por Iago (etapa D+10)', dot: '#6FD3A2' });
      if (st === 3 && !wSent) tl.push({ d: '17/09', t: 'Etapa D+10: WhatsApp aguardando envio', dot: '#EDB866' });
      inf.tl.forEach((e) => tl.push({ d: e[0], t: e[1], dot: '#6E727B' }));
      const pf = this.perfTone(inf.perfil);
      const primeiro = c.cli.split(' ')[0];
      return {
        cli: c.cli, cs: inf.cs, valTxt: this.money0(c.tot), nParc: c.ps.length + (c.ps.length === 1 ? ' parcela' : ' parcelas'), dias: c.dias + (c.dias === 1 ? ' dia' : ' dias'),
        etapa, etapaFg, prox, ultimo, perfil: inf.perfil, perfFg: pf[0], perfBg: pf[1], open, chev: open ? 'rotate(180deg)' : 'none', bg: open ? '#1A1C20' : 'transparent',
        toggle: () => this.setState({ inadOpen: open ? null : c.cli, promFor: null }),
        parcs: c.ps.map((p) => ({ desc: p.desc, venc: this.dd(p.d) + '/09', val: this.money(p.dv.saldo), atual: this.money(p.dv.saldo + p.dv.enc) + ' atualizado', open: () => this.setState({ fichaId: p.id }) })),
        whatsPend: st === 3 && !wSent && !prom,
        msg: 'Olá, tudo bem? Aqui é da Viofilme. A fatura de setembro da ' + c.cli + ', no valor de ' + this.money(c.tot) + ', venceu em ' + this.dd(c.ps[0].d) + '/09. Segue o link para pagamento: pay.asaas.com/i/vf-' + c.ps[0].id + '8821. Qualquer dúvida, estamos por aqui.',
        abrirWhats: () => this.say('Abriria o WhatsApp de ' + primeiro + ' com a mensagem pronta'),
        marcarWhats: () => { const w = Object.assign({}, s.whatsSent); w[c.cli] = true; this.setState({ whatsSent: w }); this.say('WhatsApp registrado na linha do tempo de ' + c.cli); },
        tl,
        lembrete: () => this.say('Abriria o envio de lembrete: canal (e-mail ou WhatsApp) e mensagem pronta'),
        contato: () => this.say('Abriria o registro de contato: nota e resultado (não atendeu, vai pagar, pediu prazo, contestou)'),
        promForm: s.promFor === c.cli, promValor: this.money(c.totAt),
        promAbrir: () => this.setState({ promFor: s.promFor === c.cli ? null : c.cli }),
        promSalvar: () => { const pr = Object.assign({}, s.promises); const d = this.pd(s.promData); pr[c.cli] = { data: this.dd(d.getDate()) + '/' + this.dd(d.getMonth() + 1) }; this.setState({ promises: pr, promFor: null }); this.say('Promessa registrada. A régua de ' + c.cli + ' fica pausada até ' + pr[c.cli].data); },
        renegociar: () => this.say('Abriria o acordo: parcelas selecionadas, encargos, dispensa e novas parcelas'),
        pausar: () => this.say('Pediria motivo e prazo para pausar a régua'),
        acionarCs: () => this.say('CS (Bruna) notificada com o resumo da pendência de ' + c.cli),
        perda: () => this.say('Pediria o motivo e lançaria em Perdas com recebíveis, sem apagar nada')
      };
    });

    const clis = this.clients();
    const qc = s.qCli.trim().toLowerCase();
    const cliRows = clis.filter((c) => !qc || c.nome.toLowerCase().includes(qc)).map((c) => {
      const ps = P.filter((p) => p.cli === c.nome);
      const ab = ps.filter((p) => !p.dv.settled && !p.dv.overdue).reduce((a, p) => a + p.dv.saldo, 0);
      const vc = ps.filter((p) => p.dv.overdue).reduce((a, p) => a + p.dv.saldo, 0);
      const pf = this.perfTone(c.perfil);
      return { nome: c.nome, inc: !!c.inc, sub: c.inc ? c.inc + ' para boleto' : 'Desde ' + c.desde, mrr: c.mrr ? this.money0(c.mrr) : '—', servs: c.servs.map((n) => ({ n })), aberto: ab ? this.money0(ab) : '—', venc: vc ? this.money0(vc) : '—', vencColor: vc ? '#F08A84' : '#A6A9B1', rec12: this.money0(c.rec12), atraso: c.atraso, perfil: c.perfil, perfFg: pf[0], perfBg: pf[1], open: () => this.setState({ cliNome: c.nome }) };
    });
    const incN = clis.filter((c) => c.inc).length;

    let f = { dots: [], itens: [], cobSteps: [], baixas: [], hist: [] };
    const fp = P.find((p) => p.id === s.fichaId);
    if (fp) {
      const dv = fp.dv; const cinfo = clis.find((c) => c.nome === fp.cli) || {};
      const n = fp.parc ? fp.parc[1] : 1; const cur = fp.parc ? fp.parc[0] : 1;
      const dots = []; for (let i = 1; i <= n; i++) { const paid = i < cur || (i === cur && dv.settled); dots.push({ t: 'Parcela ' + i, bg: paid ? '#6FD3A2' : (i === cur ? '#2C2F36' : 'transparent'), border: paid ? '#6FD3A2' : (i === cur ? accent : '#454852') }); }
      const cobIdx = dv.settled ? 4 : fp.cob === 'viewed' ? 3 : fp.cob === 'sent' ? 2 : 1;
      const cobSteps = [['Criada', '01/09'], ['Enviada', fp.cobSent || (fp.cob === 'scheduled' ? 'em ' + fp.cobInfo : '—')], ['Visualizada', fp.cobView || '—'], ['Paga', fp.recebidoEm || '—']].map((c, i) => ({ t: c[0], d: c[1], bar: i < cobIdx ? '#6FD3A2' : '#2C2F36', fg: i < cobIdx ? '#EEEEF0' : '#A6A9B1' }));
      let regua = 'Próximo passo: lembrete por e-mail no dia do vencimento (D+0).';
      if (dv.settled) regua = 'Régua encerrada: parcela recebida.';
      else if (dv.overdue) { const st = stageOf(dv.dias); regua = st === 3 ? (s.whatsSent[fp.cli] ? 'Etapa D+10 concluída (WhatsApp enviado). Próximo: acionar CS no D+20.' : 'Etapa atual: D+10, WhatsApp pendente de envio. Próximo: acionar CS no D+20.') : 'Etapa atual: D+3, aviso de atraso enviado. Próximo: WhatsApp no D+10.'; if (s.promises[fp.cli]) regua = 'Régua pausada: promessa de pagamento para ' + s.promises[fp.cli].data + '.'; }
      else if (fp.cob === 'none') regua = 'Sem cobrança emitida. O envio automático não está programado para esta parcela.';
      else if (fp.cob === 'scheduled') regua = 'Envio automático programado para ' + fp.cobInfo + ' (D−5).';
      const hist = [];
      if (fp.recebidoEm) hist.push({ d: fp.recebidoEm, t: 'Recebimento registrado' + (fp.conc ? ' e confirmado no extrato' : ', aguardando confirmação no extrato') });
      if (fp.cobView) hist.push({ d: fp.cobView, t: 'Cliente abriu a cobrança (Asaas)' });
      if (fp.cobSent) hist.push({ d: fp.cobSent, t: 'Cobrança enviada automaticamente para ' + (cinfo.contato || 'o cliente') });
      hist.push({ d: '01/09', t: fp.origem === 'rec' ? 'Gerada automaticamente pela recorrência' : 'Parcela ' + (fp.parc ? fp.parc[0] + ' de ' + fp.parc[1] : '') + ' criada com o projeto, por Iago Lima' });
      const semCob = !dv.settled && fp.cob === 'none';
      f = {
        id: String(fp.id), cli: fp.cli, desc: fp.desc,
        saldoTxt: this.money(dv.settled ? fp.valor : dv.saldo),
        sub: dv.settled ? 'Recebido em ' + fp.recebidoEm : dv.overdue ? this.money(dv.saldo + dv.enc) + ' atualizado hoje, com multa e juros' : fp.pago > 0 ? 'Saldo de ' + this.money(fp.valor) + ', já recebido ' + this.money(fp.pago) : 'Valor da parcela',
        subColor: dv.overdue ? '#EDB866' : '#A6A9B1',
        chip: dv.chip, chipFg: dv.fg, chipBg: dv.bg, cobTxt: dv.cobTxt, cobFg: dv.cobFg,
        origem: fp.origem === 'rec' ? 'Gerada pela recorrência “' + fp.cli + ' — Mensalidade”' : 'Parte do projeto “' + fp.projeto + '”, criado por Iago Lima em 04/08',
        goOrigem: () => { if (fp.origem === 'rec') { const i = recs.findIndex((r) => r[0] === fp.cli); this.setState({ fichaId: null, tab: 'rec', recId: i >= 0 ? i : null }); } else this.say('Abriria o projeto na Operação'); },
        openCli: () => this.setState({ cliNome: fp.cli }),
        canReceive: !dv.settled, settled: dv.settled,
        receber: () => this.abrirBaixa(fp), cobLabel: semCob ? 'Enviar cobrança' : 'Reenviar cobrança',
        cobrar: () => { this.enviarCob([fp.id]); this.say(semCob ? 'Cobrança enviada via Asaas' : 'Cobrança reenviada para ' + fp.cli); },
        comprovante: () => this.say('Abriria o comprovante'),
        editar: () => this.say(fp.origem === 'rec' ? 'Editar perguntaria: aplicar só a esta parcela ou a esta e às próximas (altera a recorrência)' : 'Abriria a edição com aviso de reemissão da cobrança'),
        more: () => this.say('Menu: alterar vencimento, renegociar, duplicar, cancelar, estornar recebimento'),
        vencFull: this.dd(fp.d) + '/' + this.dd(fp.m) + '/2026', comp: 'Setembro 2026', conta: fp.conta, forma: 'Asaas, PIX e boleto',
        nf: fp.nf || 'Pendente', nfColor: fp.nf ? '#EEEEF0' : '#EDB866',
        dots, parcTxt: cur + ' de ' + n,
        itens: fp.itens.map((it) => ({ serv: it[0], dims: this.cat(it[0], fp.origem) + ', centro de custo Entrega' + (fp.projeto ? ', projeto ' + fp.projeto : ''), val: this.money(it[1]) })),
        cobSteps, hasLink: fp.cob !== 'none' && fp.cob !== 'scheduled', regua,
        emails: 'financeiro@' + fp.cli.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 14) + '.com.br',
        noBaixa: fp.baixas.length === 0,
        baixas: fp.baixas.map((b) => ({ data: b.data, desc: b.desc, val: this.money(b.val), conc: b.conc ? 'Confirmado no extrato' : 'Aguardando confirmação no extrato', concFg: b.conc ? '#6FD3A2' : '#A6A9B1' })),
        hist
      };
    }

    let cf = { parcs: [] };
    const cc = clis.find((c) => c.nome === s.cliNome);
    if (cc) {
      const ps = P.filter((p) => p.cli === cc.nome && p.m === s.mes);
      const ab = P.filter((p) => p.cli === cc.nome && !p.dv.settled && !p.dv.overdue).reduce((a, p) => a + p.dv.saldo, 0);
      const vc = P.filter((p) => p.cli === cc.nome && p.dv.overdue).reduce((a, p) => a + p.dv.saldo, 0);
      const pf = this.perfTone(cc.perfil);
      const slug = cc.nome.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 14);
      cf = {
        nome: cc.nome, perfil: cc.perfil, perfFg: pf[0], perfBg: pf[1], desde: cc.desde, inc: !!cc.inc, incTxt: cc.inc,
        mrr: cc.mrr ? this.money0(cc.mrr) : '—', aberto: this.money0(ab), venc: this.money0(vc), vencColor: vc ? '#F08A84' : '#EEEEF0', rec12: this.money0(cc.rec12), atraso: cc.atraso,
        emDia: cc.perfil === 'Pontual' ? '94%' : cc.perfil === 'Atrasa às vezes' ? '78%' : '52%',
        razao: cc.nome + ' Ltda', cnpj: cc.inc === 'Falta CNPJ' ? 'Não informado' : this.dd(10 + cc.idx) + '.' + (345 + cc.idx * 7) + '.' + (600 + cc.idx * 11) + '/0001-' + this.dd(20 + cc.idx * 3), cnpjColor: cc.inc === 'Falta CNPJ' ? '#EDB866' : '#EEEEF0',
        end: cc.inc === 'Falta endereço' ? 'Não informado' : 'Av. Nossa Senhora da Penha, ' + (400 + cc.idx * 57) + ', Vitória/ES', endColor: cc.inc === 'Falta endereço' ? '#EDB866' : '#EEEEF0',
        im: cc.inc ? '—' : String(1200000 + cc.idx * 3391),
        contato: cc.contato, whats: '(27) 99' + (812 + cc.idx) + '-' + (4400 + cc.idx * 13), emails: 'financeiro@' + slug + '.com.br, ' + cc.contato.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '@' + slug + '.com.br',
        forma: 'Asaas, PIX e boleto', dia: String(cc.dia),
        parcs: ps.map((p) => ({ desc: p.desc, venc: this.dd(p.d) + '/' + this.dd(p.m), chip: p.dv.chip, chipFg: p.dv.fg, chipBg: p.dv.bg, val: this.money(p.valor), open: () => this.setState({ fichaId: p.id, cliNome: null }) })),
        noParcs: ps.length === 0,
        novaReceita: () => { const nf = this.nfInit(cc.nome); nf.tipo = cc.mrr ? 'unica' : 'parcelada'; nf.dia = String(cc.dia); this.setState({ cliNome: null, novaOpen: true, nf }); }
      };
    }

    let rf = { tl: [], itens: [], versoes: [] };
    if (s.recId !== null && recs[s.recId]) {
      const r = recs[s.recId]; const paus = r[7] === 'Pausada';
      const pr = P.find((p) => p.cli === r[0] && p.origem === 'rec');
      const ms = ['jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez', 'jan'];
      const tl = ms.map((m, i) => {
        if (paus && i >= 2) return { m, s: i < 5 ? 'pausada' : 'projetada', bg: 'transparent', border: '#454852', bstyle: 'dashed', fg: '#A6A9B1' };
        if (i < 3) return { m, s: 'paga', bg: 'rgba(111,211,162,0.5)', border: '#6FD3A2', bstyle: 'solid', fg: '#6FD3A2' };
        if (i === 3) { const st = pr ? (pr.dv.settled ? 'paga' : pr.dv.overdue ? 'vencida' : 'em aberto') : 'em aberto'; const c = st === 'paga' ? '#6FD3A2' : st === 'vencida' ? '#F08A84' : '#86B4F7'; return { m, s: st, bg: st === 'paga' ? 'rgba(111,211,162,0.5)' : 'transparent', border: c, bstyle: 'solid', fg: c }; }
        if (i <= 5) return { m, s: 'gerada', bg: 'transparent', border: '#86B4F7', bstyle: 'solid', fg: '#A6A9B1' };
        return { m, s: 'projetada', bg: 'transparent', border: '#454852', bstyle: 'dashed', fg: '#A6A9B1' };
      });
      const itens = r[1].length === 2 ? [{ serv: r[1][0], val: this.money(Math.round(r[2] * 0.65 / 100) * 100) }, { serv: r[1][1], val: this.money(r[2] - Math.round(r[2] * 0.65 / 100) * 100) }] : [{ serv: r[1][0], val: this.money(r[2]) }];
      const versoes = r[3] ? [{ d: r[3].includes('ago') ? '01/08/2026' : '01/07/2026', t: 'Upsell: inclusão de Tráfego pago', v: this.money0(r[2]) }, { d: r[5].replace('Desde ', ''), t: 'Recorrência criada', v: this.money0(r[2] - this.parse(r[3].replace('+ R$ ', '').split(' ')[0])) }] : [{ d: r[5].replace('Desde ', '').replace('Até ', 'até '), t: 'Recorrência criada, sem alterações de valor', v: this.money0(r[2]) }];
      rf = { cli: r[0], valTxt: this.money0(r[2]), dia: String(r[4]), status: r[7], stFg: paus ? '#EDB866' : '#6FD3A2', stBg: paus ? 'rgba(237,184,102,0.14)' : 'rgba(111,211,162,0.13)', tl, itens, versoes, vig: r[5], reaj: r[6] };
    }

    const nf = s.nf;
    const tipo = nf.tipo;
    const nfItensVals = nf.itens.map((it) => this.parse(it.val));
    const total = nfItensVals.reduce((a, b) => a + b, 0);
    const autoDesc = tipo === 'recorrente' ? 'Mensalidade' : tipo === 'parcelada' ? 'Projeto' : 'Serviço avulso';
    const nfDesc = nf.descTouched ? nf.desc : autoDesc;
    const tipos = [['unica', 'Única', 'Um vencimento'], ['parcelada', 'Parcelada', 'Projeto em parcelas'], ['recorrente', 'Recorrente', 'Mensalidade, contrato']].map(([k, label, sub]) => ({ label, sub, on: tipo === k, border: tipo === k ? accent : '#2C2F36', bg: tipo === k ? 'rgba(169,155,255,0.08)' : '#191B1F', pick: () => this.setNf({ tipo: k }) }));
    const catTipo = tipo === 'recorrente' ? 'rec' : 'proj';
    const nfItens = nf.itens.map((it, i) => ({
      serv: it.serv, val: it.val, cat: this.cat(it.serv, catTipo),
      onServ: (e) => { const a = nf.itens.slice(); a[i] = Object.assign({}, a[i], { serv: e.target.value }); this.setNf({ itens: a }); },
      onVal: (e) => { const a = nf.itens.slice(); a[i] = Object.assign({}, a[i], { val: e.target.value }); this.setNf({ itens: a }); },
      remove: () => { if (nf.itens.length > 1) this.setNf({ itens: nf.itens.filter((_, j) => j !== i) }); }
    }));
    const cinfoNf = clis.find((c) => c.nome === nf.cli);
    const pvParcs = []; let pvMais = false, pvMaisTxt = '', pvTitulo = '', pvSub = '';
    if (tipo === 'unica') {
      const d = this.pd(nf.venc);
      pvParcs.push({ n: '1', venc: 'Vence em ' + this.fd(d), comp: 'Competência ' + this.compOf(d), val: this.money(total), bstyle: 'solid' });
      pvTitulo = 'Uma conta a receber'; pvSub = this.money(total) + (nf.cli ? ' de ' + nf.cli : '');
    } else if (tipo === 'parcelada') {
      const n = parseInt(nf.nParc, 10); const d0 = this.pd(nf.primVenc); const base = Math.floor(total / n * 100) / 100;
      for (let i = 0; i < n; i++) { const d = this.addM(d0, i); const v = i === n - 1 ? total - base * (n - 1) : base; if (i < 4 || i === n - 1) pvParcs.push({ n: (i + 1) + '/' + n, venc: 'Vence em ' + this.fd(d), comp: 'Competência ' + (nf.compMode === 'cada' ? this.compOf(d) : this.compOf(d0)), val: this.money(v), bstyle: 'solid' }); }
      if (n > 5) { pvMais = true; pvMaisTxt = (n - 5) + ' parcelas intermediárias ocultas'; }
      pvTitulo = n + ' parcelas de ' + this.money(base); pvSub = 'Total de ' + this.money(total) + (nf.cli ? ', ' + nf.cli : '');
    } else {
      const d0 = this.pd(nf.inicio); const dia = parseInt(nf.dia, 10);
      let first = new Date(d0.getFullYear(), d0.getMonth(), Math.min(dia, 28)); if (first < d0) first = this.addM(first, 1, dia);
      for (let i = 0; i < 3; i++) { const d = this.addM(first, i, dia); const cd = nf.compRef === 'anterior' ? this.addM(d, -1, 1) : d; pvParcs.push({ n: String(i + 1), venc: 'Vence em ' + this.fd(d), comp: 'Competência ' + this.compOf(cd), val: this.money(total), bstyle: i === 0 ? 'solid' : 'dashed' }); }
      pvMais = true; pvMaisTxt = nf.termino === 'sem' ? 'E segue todo mês, sem término. O sistema mantém 3 meses gerados à frente.' : nf.termino === 'data' ? 'E segue todo mês até dezembro de 2026.' : 'E segue até completar 12 cobranças.';
      pvTitulo = 'Recorrência de ' + this.money(total) + ' por mês'; pvSub = 'MRR sobe ' + this.money0(total) + (nf.cli ? ', ' + nf.cli : '');
    }
    const pvLinhas = [];
    if (nf.forma === 'Sem cobrança') pvLinhas.push({ t: 'Sem cobrança automática. O recebimento será registrado manualmente.' });
    else if (nf.forma.startsWith('Manual')) pvLinhas.push({ t: 'Cobrança manual por transferência. Sem link de pagamento.' });
    else pvLinhas.push({ t: 'Cobrança pelo ' + nf.forma + (nf.envio ? ', enviada 5 dias antes de cada vencimento.' : '. Envio manual.') });
    pvLinhas.push({ t: 'Régua padrão: lembrete no vencimento, aviso no D+3, WhatsApp no D+10.' });
    const servs = Array.from(new Set(nf.itens.map((i) => i.serv)));
    pvLinhas.push({ t: 'Receita separada por serviço: ' + servs.join(', ') + '.' });
    if (tipo === 'recorrente' && nf.reaj !== 'nenhum') pvLinhas.push({ t: 'Reajuste anual com aviso 30 dias antes.' });
    const pvErros = [];
    if (!nf.cli) pvErros.push({ t: 'Escolher o cliente' });
    if (total <= 0) pvErros.push({ t: 'Informar o valor de ao menos um item' });
    if (cinfoNf && cinfoNf.inc && nf.forma.includes('boleto')) pvErros.push({ t: cinfoNf.inc + ' no cadastro do cliente para emitir boleto (ou troque para só PIX)' });
    const compOpts = [['cada', 'Uma por parcela, no mês de cada vencimento'], ['toda', 'Toda no mês da primeira parcela (entrega única)']].map(([k, label]) => ({ label, on: nf.compMode === k, border: nf.compMode === k ? accent : '#2C2F36', bg: nf.compMode === k ? 'rgba(169,155,255,0.07)' : 'transparent', dot: nf.compMode === k ? accent : '#454852', fill: nf.compMode === k ? accent : 'transparent', pick: () => this.setNf({ compMode: k }) }));
    const doSave = (mode) => {
      if (pvErros.length) { this.say('Ainda falta: ' + pvErros.map((e) => e.t.toLowerCase()).join(', ')); return; }
      const novas = []; const base = s.parcels.length + 100;
      const itens = nf.itens.map((it) => [it.serv, this.parse(it.val)]);
      const cob = nf.forma === 'Sem cobrança' ? 'none' : mode === 'enviar' ? 'sent' : 'scheduled';
      if (tipo === 'unica') { const d = this.pd(nf.venc); novas.push({ d: d.getDate(), m: d.getMonth() + 1, valor: total, parc: null }); }
      else if (tipo === 'parcelada') { const n = parseInt(nf.nParc, 10); const d0 = this.pd(nf.primVenc); for (let i = 0; i < n; i++) { const d = this.addM(d0, i); novas.push({ d: d.getDate(), m: d.getMonth() + 1, valor: total / n, parc: [i + 1, n] }); } }
      else { const d = this.pd(pvParcs[0].venc.replace('Vence em ', '').split('/').reverse().join('-')); novas.push({ d: d.getDate(), m: d.getMonth() + 1, valor: total, parc: null }); }
      const add = novas.map((x, i) => Object.assign({ id: base + i, cli: nf.cli, desc: nfDesc + (tipo === 'recorrente' ? ' ' + ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][x.m - 1] + '/26' : ''), pago: 0, cob, cobSent: cob === 'sent' ? '17/09' : null, cobInfo: 'D−5', origem: tipo === 'recorrente' ? 'rec' : tipo === 'parcelada' ? 'proj' : 'avulsa', projeto: nfDesc, conta: 'Asaas', recebidoEm: null, conc: false, nf: null, baixas: [], itens }, x));
      const firstM = add[0].m;
      this.setState({ parcels: s.parcels.concat(add), novaOpen: mode === 'outra', nf: this.nfInit(mode === 'outra' ? nf.cli : ''), mes: firstM, view: 'aberto', tab: 'contas' });
      this.say((tipo === 'recorrente' ? 'Recorrência criada. Primeira parcela em ' : add.length > 1 ? add.length + ' parcelas criadas. Primeira em ' : 'Conta a receber criada para ') + this.dd(add[0].d) + '/' + this.dd(add[0].m) + (mode === 'enviar' ? ', cobrança enviada' : ''));
    };

    const bp = P.find((p) => p.id === s.baixaId);
    let bx = {}; let parcOpts = [];
    if (bp) {
      const dv = bp.dv; const enc = s.bForm.dispensa ? 0 : dv.enc;
      const v = this.parse(s.bForm.valor); const principal = v - enc; const dif = dv.saldo - principal;
      bx = { sub: bp.cli + ', ' + bp.desc.toLowerCase() + '. Saldo de ' + this.money(dv.saldo), atrasada: dv.overdue, dias: dv.dias + ' dias', encTxt: this.money(dv.enc), encDet: 'Multa de 2% (' + this.money(dv.saldo * 0.02) + ') e juros de 1% ao mês pro rata (' + this.money(dv.enc - dv.saldo * 0.02) + '). Valor atualizado: ' + this.money(dv.saldo + dv.enc) + '.', menor: dif > 0.009, difTxt: 'O valor cobre ' + this.money(Math.max(0, principal)) + ' do saldo. Faltam ' + this.money(dif) + '.', temCob: bp.cob === 'sent' || bp.cob === 'viewed' };
      parcOpts = [['manter', 'Manter ' + this.money(dif) + ' em aberto (pagamento parcial)'], ['desconto', 'Dar desconto de ' + this.money(dif) + ' e quitar']].map(([k, label]) => ({ label, on: s.bForm.modo === k, border: s.bForm.modo === k ? accent : '#2C2F36', bg: s.bForm.modo === k ? 'rgba(169,155,255,0.07)' : 'transparent', dot: s.bForm.modo === k ? accent : '#454852', fill: s.bForm.modo === k ? accent : 'transparent', pick: () => this.setB({ modo: k }) }));
    }
    const motivos = ['Acordo com cliente', 'Atraso nosso', 'Cortesia'].map((t) => ({ t, on: s.bForm.motivo === t, border: s.bForm.motivo === t ? accent : '#33363E', bg: s.bForm.motivo === t ? 'rgba(169,155,255,0.12)' : 'transparent', pick: () => this.setB({ motivo: t }) }));
    const confirmarBaixa = () => {
      if (!bp) return;
      const dv = bp.dv; const enc = s.bForm.dispensa ? 0 : dv.enc; const v = this.parse(s.bForm.valor);
      let principal = Math.min(dv.saldo, v - enc); if (principal <= 0) { this.say('Informe um valor maior que zero'); return; }
      const quitaDesconto = dv.saldo - principal > 0.009 && s.bForm.modo === 'desconto';
      const dd = this.pd(s.bForm.data); const dataTxt = this.dd(dd.getDate()) + '/' + this.dd(dd.getMonth() + 1);
      const parcels = s.parcels.map((p) => {
        if (p.id !== bp.id) return p;
        const pago = quitaDesconto ? p.valor : p.pago + principal;
        return Object.assign({}, p, { pago, recebidoEm: dataTxt, conta: s.bForm.conta, conc: false, cob: s.bForm.cancelCob && pago < p.valor ? p.cob : p.cob, baixas: p.baixas.concat([{ data: dataTxt, desc: 'Registrado manualmente, conta ' + s.bForm.conta + (enc ? ', com ' + this.money(enc) + ' de encargos' : '') + (s.bForm.dispensa ? ', encargos dispensados (' + s.bForm.motivo.toLowerCase() + ')' : '') + (quitaDesconto ? ', desconto de ' + this.money(dv.saldo - principal) : ''), val: principal + enc, conc: false }]) });
      });
      this.setState({ parcels, baixaId: null });
      const rest = quitaDesconto ? 0 : dv.saldo - principal;
      this.say('Recebimento registrado: ' + bp.cli + ', ' + this.money(principal + enc) + (rest > 0.009 ? '. Saldo de ' + this.money(rest) + ' segue em aberto' : '') + '. Aguardando confirmação no extrato ' + s.bForm.conta + '.');
    };

    return {
      accent, mesNome, mesLabel,
      importar: () => this.say('Abriria a importação de receitas por CSV, com mapeamento de colunas'),
      abrirNova: () => this.setState({ novaOpen: true, nf: this.nfInit('') }),
      kAVencer: this.money0(aVencer.reduce((a, p) => a + p.dv.saldo, 0)), kAVencerCtx: aVencer.length + ' parcelas, ' + semCobAll.length + ' sem cobrança',
      kRecebido: this.money0(monthPago), kRecPct: (monthTotal ? Math.round(monthPago / monthTotal * 100) : 0) + '%', kRecCtx: (monthTotal ? Math.round(monthPago / monthTotal * 100) : 0) + '% de ' + this.money0(monthTotal) + ' previstos',
      kVencido: this.money0(vencTot), kVencColor: vencTot ? '#F08A84' : '#EEEEF0', kVencCtx: vencClis.length ? vencClis.length + (vencClis.length === 1 ? ' cliente' : ' clientes') + ', mais antigo há ' + maxDias + ' dias' : 'Nenhum atraso',
      kpiAberto: () => this.setState({ tab: 'contas', view: 'aberto' }), kpiRecebido: () => this.setState({ tab: 'contas', view: 'recebidas' }), kpiVencido: () => this.setState({ tab: 'inad' }),
      tabs, tabContas: s.tab === 'contas', tabRec: s.tab === 'rec', tabInad: s.tab === 'inad', tabCli: s.tab === 'cli',
      views, bases, mesPrev: () => this.setState({ mes: Math.max(8, s.mes - 1), sel: [] }), mesNext: () => this.setState({ mes: Math.min(12, s.mes + 1), sel: [] }),
      q: s.q, onQ: (e) => this.setState({ q: e.target.value }),
      filtroToast: () => this.say('Abriria o filtro com busca e múltipla escolha'), colunasToast: () => this.say('Colunas opcionais: competência, serviço, forma de cobrança, conta, NF, origem. Salvas por usuário'),
      semCob: s.semCob, toggleSemCob: () => this.setState({ semCob: !s.semCob, view: 'aberto' }), semCobCount: String(semCobAll.length), semCobBorder: s.semCob ? '#EDB866' : '#33363E', semCobBg: s.semCob ? 'rgba(237,184,102,0.12)' : '#22252B', semCobFg: s.semCob ? '#EDB866' : '#EEEEF0',
      rows, rowsEmpty: rows.length === 0,
      allSel: rows.length > 0 && list.every((p) => s.sel.includes(p.id)), toggleAll: () => this.setState({ sel: list.every((p) => s.sel.includes(p.id)) ? [] : list.map((p) => p.id) }),
      footCount: list.length + (list.length === 1 ? ' parcela' : ' parcelas') + ' neste filtro',
      footTotal: this.money0(sumL((p) => p.valor)), footAberto: this.money0(sumL((p) => p.dv.overdue ? 0 : p.dv.saldo)), footRec: this.money0(sumL((p) => Math.min(p.pago, p.valor))), footVenc: this.money0(sumL((p) => p.dv.overdue ? p.dv.saldo : 0)),
      hasSel: s.sel.length > 0 && s.tab === 'contas', selTxt: s.sel.length + (s.sel.length === 1 ? ' selecionada, ' : ' selecionadas, ') + this.money0(selP.reduce((a, p) => a + p.dv.saldo, 0)),
      loteEmitir: () => { const ids = selP.filter((p) => !p.dv.settled && p.cob !== 'sent' && p.cob !== 'viewed').map((p) => p.id); this.enviarCob(ids); this.setState({ sel: [] }); this.say(ids.length ? ids.length + (ids.length === 1 ? ' cobrança emitida' : ' cobranças emitidas') + ' via Asaas' : 'As selecionadas já têm cobrança'); },
      loteLembrete: () => this.say('Lembrete enviado para ' + new Set(selP.map((p) => p.cli)).size + ' cliente(s)'),
      loteVenc: () => this.say('Abriria a alteração de vencimento, com reemissão das cobranças'),
      loteReceber: () => { const cl = new Set(selP.map((p) => p.cli)); if (cl.size > 1) this.say('Recebimento em lote só para parcelas do mesmo cliente'); else this.say('Abriria o recebimento em lote de ' + selP.length + ' parcelas de ' + [...cl][0]); },
      loteExport: () => this.say('Exportaria as selecionadas em CSV'), clearSel: () => this.setState({ sel: [] }),
      mrrTxt: this.money0(mrr), recAtivas: String(recs.filter((r) => r[7] === 'Ativa').length), recRows,
      reajLote: () => this.say('Abriria o reajuste em lote: escolher recorrências, % e data de vigência'), revisarRasc: () => this.say('Abriria os rascunhos vindos do Comercial para revisão e ativação'),
      aging, hasAgingFilter: s.aging !== null, clearAging: () => this.setState({ aging: null }), promCount: String(Object.keys(s.promises).length),
      regua, configRegua: () => this.say('Abriria Configurações, régua de cobrança'), inadRows, inadEmpty: inadRows.length === 0,
      promData: s.promData, onPromData: (e) => this.setState({ promData: e.target.value }),
      qCli: s.qCli, onQCli: (e) => this.setState({ qCli: e.target.value }), cliRows, incompletosTxt: incN ? incN + ' com cadastro incompleto para cobrança' : '',
      novoClienteToast: () => this.say('Abriria o cadastro de cliente, com busca automática pelo CNPJ'),
      fichaOpen: !!fp, f, fichaW: s.wide ? '100%' : '580px', toggleWide: () => this.setState({ wide: !s.wide }), closeFicha: () => this.setState({ fichaId: null }),
      copiar: () => this.say('Link de pagamento copiado'), anexar: () => this.say('Abriria o seletor de arquivo'),
      cliOpen: !!cc, cf, closeCli: () => this.setState({ cliNome: null }), completarCad: () => this.say('Abriria o cadastro focado nos campos que faltam'), editarCli: () => this.say('Abriria a edição do cadastro'),
      recOpen: s.recId !== null && !!recs[s.recId], rf, closeRec: () => this.setState({ recId: null }), recAcao: () => this.say('Editar e reajustar pedem a data de vigência. Pausar e encerrar pedem o motivo'),
      novaOpen: s.novaOpen, closeNova: () => this.setState({ novaOpen: false }), nf, tipos, isUnica: tipo === 'unica', isParc: tipo === 'parcelada', isRecForm: tipo === 'recorrente',
      cliOptions: clis.concat(nf.novoCliNome ? [{ nome: nf.novoCliNome }] : []).map((c) => ({ v: c.nome })),
      onNfCli: (e) => { const v = e.target.value; if (v === '__novo') this.setNf({ novoCli: true, cli: '' }); else { const c = clis.find((x) => x.nome === v); this.setNf({ cli: v, novoCli: false, dia: c ? String(c.dia) : nf.dia }); } },
      nfCliDefaults: !!cinfoNf, nfCliInfo: cinfoNf ? 'Asaas (PIX e boleto), vencimento todo dia ' + cinfoNf.dia + ', régua padrão, contato ' + cinfoNf.contato + '.' + (cinfoNf.inc ? ' Atenção: ' + cinfoNf.inc.toLowerCase() + '.' : '') : '',
      onNfCnpj: (e) => this.setNf({ cnpj: e.target.value }), buscarCnpj: () => { this.setNf({ cnpjOk: true, cnpj: nf.cnpj || '41.228.903/0001-17' }); this.say('Dados preenchidos pela consulta do CNPJ'); },
      usarNovoCli: () => { this.setNf({ novoCli: false, cli: 'Verde Vale', novoCliNome: 'Verde Vale' }); this.say('Cliente Verde Vale cadastrado'); },
      nfDesc, onNfDesc: (e) => this.setNf({ desc: e.target.value, descTouched: true }),
      nfItens, addItem: () => this.setNf({ itens: nf.itens.concat([{ serv: 'Tráfego pago', val: '' }]) }), nfTotalTxt: this.money(total),
      onNfVenc: (e) => this.setNf({ venc: e.target.value }), compUnica: this.compOf(this.pd(nf.venc)),
      onNfNParc: (e) => this.setNf({ nParc: e.target.value }), onNfPrim: (e) => this.setNf({ primVenc: e.target.value }), compOpts,
      onNfInicio: (e) => this.setNf({ inicio: e.target.value }), onNfDia: (e) => this.setNf({ dia: e.target.value }), onNfCompRef: (e) => this.setNf({ compRef: e.target.value }), onNfTermino: (e) => this.setNf({ termino: e.target.value }), onNfReaj: (e) => this.setNf({ reaj: e.target.value }),
      onNfForma: (e) => this.setNf({ forma: e.target.value }), toggleEnvio: () => this.setNf({ envio: !nf.envio }), envioTrack: nf.envio ? accent : '#454852', envioKnob: nf.envio ? '18px' : '2px',
      nfEmails: cinfoNf ? 'financeiro@' + cinfoNf.nome.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 14) + '.com.br' : 'os e-mails de cobrança do cliente',
      toggleMais: () => this.setNf({ mais: !nf.mais }), maisChev: nf.mais ? 'rotate(90deg)' : 'none',
      pvTitulo, pvSub, pvParcs, pvMais, pvMaisTxt, pvLinhas, pvErros, pvHasErr: pvErros.length > 0,
      salvarBg: pvErros.length ? '#5A5480' : accent,
      salvar: () => doSave('salvar'), salvarEnviar: () => doSave('enviar'), salvarOutra: () => doSave('outra'),
      baixaOpen: !!bp, bx, bForm: s.bForm, parcOpts, motivos,
      onBData: (e) => this.setB({ data: e.target.value }), onBValor: (e) => this.setB({ valor: e.target.value }), onBConta: (e) => this.setB({ conta: e.target.value }),
      toggleDispensa: () => { const d = !s.bForm.dispensa; const dv = bp ? bp.dv : { saldo: 0, enc: 0 }; this.setB({ dispensa: d, valor: (dv.saldo + (d ? 0 : dv.enc)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }); },
      dispTrack: s.bForm.dispensa ? accent : '#454852', dispKnob: s.bForm.dispensa ? '16px' : '2px',
      toggleCancelCob: () => this.setB({ cancelCob: !s.bForm.cancelCob }), ccBorder: s.bForm.cancelCob ? accent : '#6E727B', ccFill: s.bForm.cancelCob ? accent : 'transparent',
      closeBaixa: () => this.setState({ baixaId: null }), confirmarBaixa,
      hasToast: !!s.toast, toast: s.toast || ''
    };
  }
}
