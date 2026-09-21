/*
MOCKUP — Pagamentos (Financeiro Viofilme) · FONTE LEGÍVEL · ARQUIVO 3 de 3
Lógica do mockup: estado, DADOS DE EXEMPLO (fictícios, mas coerentes entre si; use como exemplo de cálculo),
derivações e handlers. Os bindings {{ ... }} de mockup_pagamentos_1_pagina.html e mockup_pagamentos_2_paineis.html vêm daqui
(principalmente de renderVals()). DCLogic é a classe base do runtime do Claude Design (setState, props).
Props do componente: {"accent":{"editor":"color","default":"#A99BFF","options":["#A99BFF","#F2A97E","#9ADFB5","#E8D27A"]},"$preview":{"width":1440,"height":1500}}
*/
class Component extends DCLogic {
  constructor(...a) {
    super(...a);
    const P = (o) => Object.assign({ m: 9, pago: 0, kind: 'conta', rec: false, parc: null, cli: null, conta: 'Inter', prog: null, est: false, metodo: null, forma: 'Boleto', codigo: null, favDiv: false, docs: { boleto: false, nf: false, comp: false }, needsNF: false, pagoEm: null, conc: false, baixas: [], origem: 'Criada manualmente por Iago Lima', cc: 'Administrativo' }, o);
    const COD = '23793.38128 60012.345678 90000.123456 1 9876000';
    this.state = {
      tab: 'contas', view: 'aberto', mes: 9, q: '', chip: null, agrupar: 'nenhum', sel: [], fatTab: 'atual',
      fichaId: null, wide: false, colabId: null, fornNome: null, recIdx: null, novaOpen: false, pagarId: null, valorId: null, ajusteFor: null,
      pForm: { data: '2026-09-17', valor: '', conta: 'Inter', modo: 'manter', comp: false, just: '' },
      vForm: { valor: '', codigo: '' }, aForm: { tipo: 'Bônus', desc: '', valor: '' }, fornTipo: 'todos', recFiltro: 'todas', toast: null,
      classif: {}, faturaPaga: false,
      nd: this.ndInit(''),
      parcels: [
        P({ id: 1, forn: 'Google', desc: 'Workspace, 14 licenças', d: 17, valor: 370.10, cat: 'Softwares › Produtividade', rec: true, codigo: '00190.00009 03312.345678 90123.456789 3 9876000', docs: { boleto: true, nf: true, comp: false }, origem: 'Gerada pela recorrência “Google — Workspace”' }),
        P({ id: 2, forn: 'Imobiliária Praia Mar', desc: 'Aluguel do escritório, setembro', d: 18, valor: 4200, cat: 'Estrutura › Aluguel', rec: true, prog: 18, codigo: COD, docs: { boleto: true, nf: false, comp: false }, origem: 'Gerada pela recorrência “Aluguel do escritório”' }),
        P({ id: 3, forn: 'EDP', desc: 'Energia elétrica, agosto', d: 18, valor: 300, cat: 'Estrutura › Energia', rec: true, forma: 'Débito automático', docs: { boleto: true, nf: false, comp: false }, origem: 'Gerada pela recorrência “Energia”, valor confirmado pela conta', }),
        P({ id: 4, forn: 'Receita Federal', desc: 'DAS Simples Nacional, competência agosto', d: 20, valor: 7140, cat: 'Impostos › DAS', rec: true, est: true, metodo: '6% da receita bruta de agosto', forma: 'Guia DAS', docs: { boleto: false, nf: false, comp: false }, origem: 'Gerada pela recorrência “DAS”, estimada pela receita' }),
        P({ id: 5, forn: 'Receita Federal', desc: 'INSS sobre pró-labore, agosto', d: 20, valor: 1210, cat: 'Impostos › INSS pró-labore', rec: true, forma: 'Guia DARF', codigo: '85810.00000 1 21000.000000 0 00000000000', docs: { boleto: true, nf: false, comp: false }, origem: 'Gerada pela recorrência “INSS pró-labore”, guia informada em 12/09' }),
        P({ id: 6, forn: 'Marina Costa', desc: 'Edição de vídeo, campanha de primavera', d: 23, valor: 1200, cat: 'Custos diretos › Freelancers', cli: 'Restaurante Sabor do Mar', cc: 'Entrega', prog: 23, forma: 'PIX', codigo: 'marina.costa.edicao@gmail.com', needsNF: true, docs: { boleto: false, nf: true, comp: false }, origem: 'Veio da Operação, solicitação de freelancer nº 214' }),
        P({ id: 7, forn: 'Lucas Prado', desc: 'Captação, diária de 12/09', d: 15, valor: 1850, cat: 'Custos diretos › Freelancers', cli: 'Grupo Orla', cc: 'Entrega', forma: 'PIX', codigo: '41.228.903/0001-17', needsNF: true, docs: { boleto: false, nf: false, comp: false }, origem: 'Veio da Operação, solicitação de freelancer nº 209' }),
        P({ id: 8, forn: 'LocaCine Equipamentos', desc: 'Locação de lente e iluminação', d: 25, valor: 2600, cat: 'Custos diretos › Locação de equipamento', cli: 'Grupo Orla', cc: 'Entrega', codigo: '34191.79001 01043.510047 91020.150008 7 9876000', favDiv: true, docs: { boleto: true, nf: true, comp: false }, origem: 'Lido do boleto enviado em 12/09' }),
        P({ id: 9, forn: 'Estúdio Som Norte', desc: 'Trilha e locução', d: 24, valor: 900, cat: 'Custos diretos › Produção de áudio', cli: 'Restaurante Sabor do Mar', cc: 'Entrega', parc: [2, 3], prog: 24, forma: 'PIX', codigo: 'somnorte@estudio.com.br', needsNF: false, docs: { boleto: false, nf: true, comp: false }, origem: 'Parcelada em 3x, criada por Iago Lima em 20/08' }),
        P({ id: 10, forn: 'Vivo Empresas', desc: 'Internet e telefonia', d: 28, valor: 489.90, cat: 'Estrutura › Internet', rec: true, forma: 'Débito automático', docs: { boleto: true, nf: true, comp: false }, origem: 'Gerada pela recorrência “Internet”' }),
        P({ id: 11, forn: 'Contabilidade Ágil', desc: 'Honorários contábeis, agosto', d: 10, valor: 1400, pago: 1400, pagoEm: '10/09', conc: true, cat: 'Serviços › Contabilidade', rec: true, forma: 'PIX', codigo: '09.876.543/0001-21', docs: { boleto: false, nf: true, comp: true }, baixas: [{ data: '10/09', desc: 'PIX, conta Inter', val: 1400, conc: true }], origem: 'Gerada pela recorrência “Contabilidade”' }),
        P({ id: 12, forn: 'Pedro Alves', desc: 'Fotografia de pratos', d: 12, valor: 950, pago: 950, pagoEm: '12/09', conc: true, cat: 'Custos diretos › Freelancers', cli: 'Café Aroma', cc: 'Entrega', forma: 'PIX', codigo: 'pedroalves.foto@gmail.com', needsNF: true, docs: { boleto: false, nf: true, comp: false }, baixas: [{ data: '12/09', desc: 'PIX, conta Inter', val: 950, conc: true }], origem: 'Veio da Operação, solicitação de freelancer nº 205' }),
        P({ id: 13, forn: 'Gráfica Rápida ES', desc: 'Impressão de materiais de clínica', d: 9, valor: 780, pago: 780, pagoEm: '09/09', conc: false, cat: 'Custos diretos › Impressão e materiais', cli: 'Clínica Vitta', cc: 'Entrega', forma: 'Transferência', docs: { boleto: false, nf: true, comp: true }, baixas: [{ data: '09/09', desc: 'Transferência, conta Inter', val: 780, conc: false }] }),
        P({ id: 14, forn: 'Kabum', desc: 'SSD externo e cartões de memória', d: 3, valor: 1890, pago: 1890, pagoEm: '03/09', conc: true, cat: 'Investimentos › Equipamentos', cc: 'Entrega', forma: 'PIX', docs: { boleto: false, nf: true, comp: true }, baixas: [{ data: '03/09', desc: 'PIX, conta Inter', val: 1890, conc: true }] }),
        P({ id: 90, kind: 'folha', forn: 'Equipe', desc: 'Folha de agosto, 11 pagamentos', d: 5, valor: 47600, pago: 47600, pagoEm: '05/09', conc: true, cat: 'Pessoal › Equipe e pró-labore', forma: 'PIX em lote' }),
        P({ id: 91, kind: 'fatura', forn: 'Cartão Inter', desc: 'Fatura de setembro', d: 25, valor: 0, cat: 'Transferência para o cartão', forma: 'Transferência' }),
        P({ id: 92, kind: 'folha', m: 10, forn: 'Equipe', desc: 'Folha de setembro, 11 pagamentos', d: 5, valor: 48670, cat: 'Pessoal › Equipe e pró-labore', forma: 'PIX em lote' }),
        P({ id: 20, m: 10, forn: 'Contabilidade Ágil', desc: 'Honorários contábeis, setembro', d: 10, valor: 1400, cat: 'Serviços › Contabilidade', rec: true, forma: 'PIX', codigo: '09.876.543/0001-21', docs: { boleto: false, nf: false, comp: false } }),
        P({ id: 21, m: 10, forn: 'Imobiliária Praia Mar', desc: 'Aluguel do escritório, outubro', d: 18, valor: 4200, cat: 'Estrutura › Aluguel', rec: true, docs: { boleto: false, nf: false, comp: false } }),
        P({ id: 22, m: 10, forn: 'Receita Federal', desc: 'DAS Simples Nacional, competência setembro', d: 20, valor: 7440, cat: 'Impostos › DAS', rec: true, est: true, metodo: '6% da receita bruta de setembro', forma: 'Guia DAS' }),
        P({ id: 23, m: 10, forn: 'Estúdio Som Norte', desc: 'Trilha e locução', d: 24, valor: 900, cat: 'Custos diretos › Produção de áudio', cli: 'Restaurante Sabor do Mar', cc: 'Entrega', parc: [3, 3], forma: 'PIX', codigo: 'somnorte@estudio.com.br' })
      ],
      compras: [
        ['20/08', 'Adobe, Creative Cloud', 'Softwares › Criação', 'Operação geral', 449.90, true, null],
        ['22/08', 'Canva Teams', 'Softwares › Criação', 'Operação geral', 299.90, true, null],
        ['25/08', 'Figma, plano profissional', 'Softwares › Criação', 'Operação geral', 245.00, true, null],
        ['28/08', 'Uber, gravação', 'Transporte', 'Restaurante Sabor do Mar', 86.40, false, null],
        ['01/09', 'Notion', 'Softwares › Produtividade', 'Operação geral', 132.00, true, null],
        ['03/09', 'Envato Elements', 'Softwares › Criação', 'Operação geral', 189.00, true, null],
        ['05/09', 'Frame.io', 'Softwares › Criação', 'Operação geral', 150.00, true, null],
        ['09/09', 'iFood, almoço de gravação', 'Alimentação', 'Grupo Orla', 212.50, false, null],
        ['11/09', 'Amazon, microfone de lapela', 'Investimentos › Equipamentos', 'Operação geral', 216.33, false, '2/3'],
        ['14/09', 'Posto Shell, combustível', 'Transporte', 'Grupo Orla', 180.00, false, null],
        ['15/09', 'PAYPAL *EPIDEMICSOUN', null, '—', 99.00, false, null, 'Softwares › Trilhas (Epidemic Sound)'],
        ['16/09', 'MERCADOPAGO*LOJAFOTO', null, '—', 348.00, false, null, 'Custos diretos › Materiais de produção']
      ],
      team: [
        { id: 't1', nome: 'Ana Lima', funcao: 'Social Media', squad: 'Squad A', cc: 'Entrega', base: 3600, nf: true, pago: false, cap: 10, clientes: ['APTO', 'BNEX', 'Clínica Vitta', 'Café Aroma', 'Casa Nómade', 'Estúdio Brisa', 'Ótica Visão Clara', 'Studio Pilates Ápice', 'Mar Azul Pousada'], desde: 'mar/2024', tipo: 'PJ', aj: [] },
        { id: 't2', nome: 'Robert Oliveira', funcao: 'Designer', squad: 'Squad A', cc: 'Entrega', base: 4200, nf: true, pago: false, cap: 12, clientes: ['APTO', 'BNEX', 'Clínica Vitta', 'Café Aroma', 'Casa Nómade', 'Restaurante Sabor do Mar', 'Imobiliária Costa Norte', 'Mar Azul Pousada', 'Ótica Visão Clara', 'Atlas Engenharia'], desde: 'jan/2024', tipo: 'PJ', aj: [{ tipo: 'Reembolso', desc: 'Uber para gravação do Sabor do Mar', val: 120 }] },
        { id: 't3', nome: 'Thiago Mendes', funcao: 'Gestor de tráfego', squad: 'Squad A', cc: 'Entrega', base: 5500, nf: false, pago: false, cap: 14, clientes: ['APTO', 'Clínica Vitta', 'Atlas Engenharia', 'Imobiliária Costa Norte', 'Mar Azul Pousada', 'Nuvem Pet', 'Padaria Trigo Fino', 'Restaurante Sabor do Mar', 'BNEX', 'Casa Nómade', 'Café Aroma'], desde: 'ago/2023', tipo: 'PJ', aj: [] },
        { id: 't4', nome: 'Carla Dias', funcao: 'Social Media', squad: 'Squad B', cc: 'Entrega', base: 3400, nf: true, pago: false, cap: 10, clientes: ['Atlas Engenharia', 'Imobiliária Costa Norte', 'Restaurante Sabor do Mar', 'Nuvem Pet', 'Padaria Trigo Fino', 'Grupo Orla', 'Construtora Horizonte'], desde: 'fev/2025', tipo: 'PJ', aj: [] },
        { id: 't5', nome: 'Felipe Rocha', funcao: 'Editor de vídeo', squad: 'Audiovisual', cc: 'Entrega', base: 4000, nf: false, pago: false, cap: 8, clientes: ['Restaurante Sabor do Mar', 'Grupo Orla', 'Construtora Horizonte', 'Clínica Vitta', 'APTO', 'Imobiliária Costa Norte'], desde: 'mai/2024', tipo: 'PJ', aj: [{ tipo: 'Adiantamento', desc: 'Pago em 12/09', val: -1000 }] },
        { id: 't6', nome: 'Júlia Castro', funcao: 'Videomaker', squad: 'Audiovisual', cc: 'Entrega', base: 4300, nf: true, pago: false, cap: 8, clientes: ['Restaurante Sabor do Mar', 'Grupo Orla', 'Construtora Horizonte', 'Clínica Vitta', 'Imobiliária Costa Norte'], desde: 'out/2024', tipo: 'PJ', aj: [{ tipo: 'Job extra', desc: 'Gravação extra, Grupo Orla', val: 600 }] },
        { id: 't7', nome: 'Bruna Martins', funcao: 'Customer Success', squad: 'Relacionamento', cc: 'Entrega', base: 3800, nf: true, pago: false, cap: 20, clientes: ['Toda a carteira (16 clientes)'], desde: 'jun/2024', tipo: 'PJ', aj: [] },
        { id: 't8', nome: 'Marcos Silva', funcao: 'Comercial', squad: 'Comercial', cc: 'Comercial', base: 2800, nf: true, pago: false, cap: 0, clientes: [], desde: 'jan/2025', tipo: 'PJ', aj: [{ tipo: 'Comissão', desc: '2 negócios ganhos em agosto', val: 1350 }] },
        { id: 't9', nome: 'Gui Barros', funcao: 'Desenvolvedor', squad: 'Produto interno', cc: 'Administrativo', base: 5000, nf: true, pago: false, cap: 0, clientes: [], desde: 'abr/2025', tipo: 'PJ', aj: [] },
        { id: 't10', nome: 'Iago Lima', funcao: 'Sócio, diretoria', squad: 'Diretoria', cc: 'Diretoria', base: 5500, nf: null, pago: false, cap: 0, clientes: [], desde: 'fundação', tipo: 'Sócio', aj: [] },
        { id: 't11', nome: 'Flávio', funcao: 'Sócio, diretoria', squad: 'Diretoria', cc: 'Diretoria', base: 5500, nf: null, pago: false, cap: 0, clientes: [], desde: 'fundação', tipo: 'Sócio', aj: [] }
      ]
    };
  }
  ndInit(forn) { return { tipo: 'unica', forn: forn, desc: '', itens: [{ cat: 'Custos diretos › Freelancers', cli: '', val: '' }], forma: 'PIX', venc: '2026-09-30', prog: '', codigo: '', compra: '2026-09-17', parcCartao: '1', valorTipo: 'fixo', nParc: '3', boleto: false, nf: false, mais: false, reemb: false, lido: false }; }
  money(n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  money0(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }
  parse(s) { if (typeof s === 'number') return s; const v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(v) ? 0 : v; }
  say(msg) { this.setState({ toast: msg }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 3600); }
  componentWillUnmount() { clearTimeout(this._t); }
  mesNome(m) { return ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][m - 1]; }
  dd(n) { return String(n).padStart(2, '0'); }
  pd(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  fd(d) { return this.dd(d.getDate()) + '/' + this.dd(d.getMonth() + 1) + '/' + d.getFullYear(); }
  compOf(d) { const n = this.mesNome(d.getMonth() + 1); return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + d.getFullYear(); }
  cats() {
    return {
      'Custos diretos › Freelancers': { imp: 'direto', orc: 6000, real: 4000, dre: 'Custos diretos › Freelancers', exigeNf: true },
      'Custos diretos › Locação de equipamento': { imp: 'direto', orc: 3000, real: 2600, dre: 'Custos diretos › Locação de equipamento' },
      'Custos diretos › Produção de áudio': { imp: 'direto', orc: 1500, real: 900, dre: 'Custos diretos › Produção de áudio' },
      'Custos diretos › Impressão e materiais': { imp: 'direto', orc: 1200, real: 780, dre: 'Custos diretos › Impressão e materiais' },
      'Softwares › Criação': { imp: 'opex', orc: 8000, real: 9440, dre: 'Despesas operacionais › Softwares › Criação' },
      'Softwares › Produtividade': { imp: 'opex', orc: 8000, real: 9440, dre: 'Despesas operacionais › Softwares › Produtividade' },
      'Estrutura › Aluguel': { imp: 'opex', orc: 4200, real: 4200, dre: 'Despesas operacionais › Estrutura › Aluguel' },
      'Estrutura › Energia': { imp: 'opex', orc: 350, real: 300, dre: 'Despesas operacionais › Estrutura › Energia' },
      'Estrutura › Internet': { imp: 'opex', orc: 500, real: 489.9, dre: 'Despesas operacionais › Estrutura › Internet' },
      'Serviços › Contabilidade': { imp: 'opex', orc: 1400, real: 1400, dre: 'Despesas operacionais › Serviços › Contabilidade' },
      'Transporte': { imp: 'opex', orc: 600, real: 266.4, dre: 'Despesas operacionais › Transporte' },
      'Alimentação': { imp: 'opex', orc: 400, real: 212.5, dre: 'Despesas operacionais › Alimentação' },
      'Impostos › DAS': { imp: 'deducao', orc: 7200, real: 7140, dre: 'Deduções da receita › DAS (Simples Nacional)' },
      'Impostos › INSS pró-labore': { imp: 'opex', orc: 1210, real: 1210, dre: 'Despesas operacionais › Encargos sobre pró-labore' },
      'Investimentos › Equipamentos': { imp: 'invest', orc: 3000, real: 2106.33, dre: 'Fora da DRE: Investimentos do período' },
      'Pessoal › Equipe e pró-labore': { imp: 'pessoal', orc: 49000, real: 47600, dre: 'Custos diretos e despesas de pessoal, por centro de custo' },
      'Transferência para o cartão': { imp: 'transf', orc: 0, real: 0, dre: 'Não é despesa: as compras já entraram na competência' }
    };
  }
  derive(p) {
    const saldo = Math.max(0, p.valor - p.pago);
    const paid = p.valor > 0 && saldo < 0.01;
    const diff = (p.m - 9) * 30 + p.d - 17;
    const overdue = !paid && diff < 0;
    const dias = overdue ? -diff : 0;
    let chip, fg, bg, rel, relColor = '#A6A9B1';
    if (paid) { chip = 'Paga'; fg = '#6FD3A2'; bg = 'rgba(111,211,162,0.13)'; rel = 'Paga em ' + p.pagoEm; }
    else if (overdue) { chip = 'Vencida há ' + dias + (dias === 1 ? ' dia' : ' dias'); fg = '#F08A84'; bg = 'rgba(240,138,132,0.14)'; rel = 'há ' + dias + ' dias'; relColor = '#F08A84'; }
    else if (p.est) { chip = '~ Estimada'; fg = '#C9CBD1'; bg = 'rgba(166,169,177,0.16)'; rel = diff === 0 ? 'hoje' : 'em ' + diff + ' dias'; relColor = diff <= 7 ? '#EDB866' : '#A6A9B1'; }
    else if (p.prog) { chip = 'Programada para ' + this.dd(p.prog) + '/' + this.dd(p.m); fg = '#86B4F7'; bg = 'rgba(134,180,247,0.13)'; rel = diff === 0 ? 'hoje' : 'em ' + diff + ' dias'; relColor = diff <= 7 ? '#86B4F7' : '#A6A9B1'; }
    else if (diff === 0) { chip = 'Vence hoje'; fg = '#EDB866'; bg = 'rgba(237,184,102,0.14)'; rel = 'hoje'; relColor = '#EDB866'; }
    else if (diff <= 7) { chip = 'Vence em ' + diff + (diff === 1 ? ' dia' : ' dias'); fg = '#EDB866'; bg = 'rgba(237,184,102,0.12)'; rel = 'em ' + diff + ' dias'; relColor = '#EDB866'; }
    else { chip = 'A vencer'; fg = '#C9CBD1'; bg = 'rgba(166,169,177,0.14)'; rel = 'em ' + diff + ' dias'; }
    let payTxt, payFg = '#A6A9B1';
    if (paid) { payTxt = p.docs.comp ? 'Comprovante anexado' : 'Sem comprovante'; payFg = p.docs.comp ? '#6FD3A2' : '#EDB866'; }
    else if (p.est) { payTxt = 'Guia ainda não emitida'; payFg = '#EDB866'; }
    else if (p.favDiv) { payTxt = 'Boleto, favorecido diferente'; payFg = '#F08A84'; }
    else if (p.forma === 'Débito automático') { payTxt = 'Débito automático'; }
    else if (p.codigo) { payTxt = p.forma === 'PIX' ? 'PIX, chave do fornecedor' : (p.forma.startsWith('Guia') ? p.forma + ', código salvo' : 'Boleto, código salvo'); }
    else { payTxt = 'Sem dados de pagamento'; payFg = '#EDB866'; }
    if (!paid && p.needsNF && !p.docs.nf) { payTxt = 'NF pendente, exigida para pagar'; payFg = '#EDB866'; }
    const semProg = !paid && !p.prog && p.forma !== 'Débito automático' && p.kind === 'conta';
    return { saldo, paid, diff, overdue, dias, chip, fg, bg, rel, relColor, payTxt, payFg, semProg };
  }
  compras() {
    const s = this.state;
    return s.compras.map((c, i) => { const cl = s.classif[i]; return { i, data: c[0], desc: c[1], cat: cl || c[2], cli: c[3], val: c[4], assin: c[5], parc: c[6], sug: c[7] }; });
  }
  setNd(patch) { this.setState({ nd: Object.assign({}, this.state.nd, patch) }); }
  setP(patch) { this.setState({ pForm: Object.assign({}, this.state.pForm, patch) }); }
  abrirPagar(p) { const dv = this.derive(p); this.setState({ pagarId: p.id, pForm: { data: p.prog && p.prog < 17 ? '2026-09-' + this.dd(p.prog) : '2026-09-17', valor: dv.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), conta: p.conta, modo: 'manter', comp: false, just: '' } }); }
  updP(id, patch) { this.setState({ parcels: this.state.parcels.map((p) => p.id === id ? Object.assign({}, p, typeof patch === 'function' ? patch(p) : patch) : p) }); }
  renderVals() {
    const s = this.state;
    const accent = this.props.accent ?? '#A99BFF';
    const CATS = this.cats();
    const compras = this.compras();
    const fatTotal = compras.reduce((a, c) => a + c.val, 0);
    const P = s.parcels.map((p) => { let q = p; if (p.kind === 'fatura') q = Object.assign({}, p, { valor: fatTotal, pago: s.faturaPaga ? fatTotal : 0, pagoEm: s.faturaPaga ? '17/09' : null }); return Object.assign({}, q, { dv: this.derive(q) }); });
    const month = P.filter((p) => p.m === s.mes);
    const mesNome = this.mesNome(s.mes);
    const mesLabel = mesNome.charAt(0).toUpperCase() + mesNome.slice(1) + ' 2026';
    const nav = (d) => () => this.say('Abriria ' + d);

    const aPagar = month.filter((p) => !p.dv.paid && !p.dv.overdue);
    const vencAll = P.filter((p) => p.dv.overdue);
    const monthTotal = month.reduce((a, p) => a + p.valor, 0);
    const monthPago = month.reduce((a, p) => a + Math.min(p.pago, p.valor), 0);
    const prox7 = P.filter((p) => !p.dv.paid && p.dv.diff >= 0 && p.dv.diff <= 7);

    const chipDefs = [
      ['semprog', 'Sem programação', (p) => p.dv.semProg],
      ['est', 'Estimadas', (p) => !p.dv.paid && p.est],
      ['semdados', 'Sem dados de pagamento', (p) => !p.dv.paid && p.kind === 'conta' && !p.codigo && p.forma !== 'Débito automático'],
      ['semcomp', 'Sem comprovante', (p) => p.dv.paid && p.kind === 'conta' && !p.docs.comp],
      ['imp', 'Impostos e obrigações', (p) => p.cat.startsWith('Impostos')],
      ['cartao', 'Cartões', () => false]
    ];
    const chips = chipDefs.map(([k, label, fn]) => { const on = s.chip === k; const n = k === 'cartao' ? '' : String(month.filter(fn).length); return { label, count: n, on, border: on ? accent : '#33363E', bg: on ? 'rgba(169,155,255,0.12)' : '#22252B', fg: on ? '#EEEEF0' : '#EEEEF0', pick: () => this.setState({ chip: on ? null : k, sel: [], view: k === 'semcomp' ? 'pagas' : (k && k !== 'imp' && k !== 'cartao' ? 'aberto' : s.view) }) }; });
    const modoFatura = s.chip === 'cartao';

    const matches = (p, v) => v === 'aberto' ? !p.dv.paid : v === 'vencidas' ? p.dv.overdue : v === 'pagas' ? p.dv.paid : true;
    const views = [['aberto', 'Em aberto'], ['vencidas', 'Vencidas'], ['pagas', 'Pagas'], ['todas', 'Todas']].map(([k, label]) => ({ label, count: String(month.filter((p) => matches(p, k)).length), on: s.view === k, bg: s.view === k ? '#2C2F36' : 'transparent', fg: s.view === k ? '#EEEEF0' : '#A6A9B1', countFg: k === 'vencidas' && s.view !== k ? '#F08A84' : '#A6A9B1', pick: () => this.setState({ view: k, sel: [] }) }));
    const ql = s.q.trim().toLowerCase();
    const chipFn = chipDefs.find((c) => c[0] === s.chip);
    let list = month.filter((p) => matches(p, s.view)).filter((p) => !chipFn || s.chip === 'cartao' || chipFn[2](p)).filter((p) => !ql || p.forn.toLowerCase().includes(ql) || p.desc.toLowerCase().includes(ql) || String(Math.round(p.valor)).includes(ql.replace(/\D/g, '') || '§'));
    list = list.sort((a, b) => (b.dv.overdue - a.dv.overdue) || (a.dv.paid - b.dv.paid) || (a.dv.diff - b.dv.diff));
    const mkRow = (p) => {
      const dv = p.dv; const sel = s.sel.includes(p.id); const special = p.kind !== 'conta';
      let actLabel, act;
      if (p.kind === 'folha') { actLabel = 'Abrir folha'; act = () => this.setState({ tab: 'folha' }); }
      else if (p.kind === 'fatura') { actLabel = 'Ver fatura'; act = () => this.setState({ chip: 'cartao' }); }
      else if (dv.paid) { actLabel = 'Comprovante'; act = () => this.say(p.docs.comp ? 'Abriria o comprovante' : 'Sem comprovante. Arraste o arquivo na ficha para anexar'); }
      else if (p.est) { actLabel = 'Informar valor'; act = () => this.setState({ valorId: p.id, vForm: { valor: '', codigo: '' } }); }
      else if (p.forma === 'Débito automático') { actLabel = 'Confirmar débito'; act = () => this.abrirPagar(p); }
      else { actLabel = 'Pagar'; act = () => this.abrirPagar(p); }
      let subVal = '';
      if (p.kind === 'fatura') subVal = s.faturaPaga ? 'paga em 17/09' : 'fecha amanhã, 12 compras';
      else if (dv.paid) subVal = 'pago em ' + p.pagoEm;
      else if (p.est) subVal = p.metodo;
      else if (p.parc) subVal = 'parcela ' + p.parc[0] + ' de ' + p.parc[1];
      return {
        sel, noSel: special, toggle: () => this.setState({ sel: sel ? s.sel.filter((x) => x !== p.id) : s.sel.concat([p.id]) }),
        rowBg: sel ? 'rgba(169,155,255,0.07)' : (special ? '#1B1D22' : 'transparent'),
        vencTxt: this.dd(p.d) + '/' + this.dd(p.m), rel: dv.rel, relColor: dv.relColor,
        forn: p.forn, desc: p.desc, isRec: p.rec, hasParc: !!p.parc, parc: p.parc ? p.parc[0] + '/' + p.parc[1] : '',
        cat: p.cat, hasCli: !!p.cli, cli: p.cli || '',
        chip: p.kind === 'fatura' && !dv.paid ? 'Em formação' : dv.chip, chipFg: p.kind === 'fatura' && !dv.paid ? '#C4B9FF' : dv.fg, chipBg: p.kind === 'fatura' && !dv.paid ? 'rgba(169,155,255,0.14)' : dv.bg,
        payTxt: p.kind === 'folha' ? (dv.paid ? 'Todos os comprovantes anexados' : '7 de 9 NFs recebidas') : p.kind === 'fatura' ? 'Pagamento da fatura = transferência' : dv.payTxt,
        payFg: p.kind === 'folha' ? (dv.paid ? '#6FD3A2' : '#EDB866') : p.kind === 'fatura' ? '#A6A9B1' : dv.payFg,
        valTxt: (p.est && !dv.paid ? '~ ' : '') + this.money(dv.paid ? p.valor : dv.saldo), valColor: p.est && !dv.paid ? '#C9CBD1' : '#EEEEF0', valStyle: p.est && !dv.paid ? 'italic' : 'normal', subVal,
        hasCopy: !dv.paid && !!p.codigo && p.kind === 'conta', copy: () => this.say((p.forma === 'PIX' ? 'Chave PIX' : 'Linha digitável') + ' de ' + p.forn + ' copiada' + (p.favDiv ? '. Atenção: favorecido diferente do fornecedor' : '')),
        actLabel, act, more: () => this.say('Menu: programar, alterar vencimento, informar valor real, anexar documento, duplicar, cancelar'),
        open: () => { if (p.kind === 'folha') this.setState({ tab: 'folha' }); else if (p.kind === 'fatura') this.setState({ chip: 'cartao' }); else this.setState({ fichaId: p.id }); },
        openForn: () => { if (p.kind === 'conta') this.setState({ fornNome: p.forn }); else if (p.kind === 'folha') this.setState({ tab: 'folha' }); else this.setState({ chip: 'cartao' }); }
      };
    };
    let groups;
    if (s.agrupar === 'nenhum') groups = [{ hasHeader: false, name: '', sub: '', rows: list.map(mkRow) }];
    else {
      const key = (p) => s.agrupar === 'categoria' ? p.cat.split(' › ')[0] : p.forma;
      const names = Array.from(new Set(list.map(key)));
      groups = names.map((n) => { const ps = list.filter((p) => key(p) === n); return { hasHeader: true, name: n, sub: ps.length + (ps.length === 1 ? ' conta, ' : ' contas, ') + this.money0(ps.reduce((a, p) => a + (p.dv.paid ? p.valor : p.dv.saldo), 0)), rows: ps.map(mkRow) }; });
    }
    const sumL = (f) => list.reduce((a, p) => a + f(p), 0);
    const selP = P.filter((p) => s.sel.includes(p.id));

    const fatAtual = compras;
    const porCatMap = {};
    fatAtual.forEach((c) => { const k = c.cat ? c.cat.split(' › ')[0] : 'Sem classificação'; porCatMap[k] = (porCatMap[k] || 0) + c.val; });
    const porCatArr = Object.entries(porCatMap).sort((a, b) => b[1] - a[1]); const pcMax = porCatArr.length ? porCatArr[0][1] : 1;
    const unclass = fatAtual.filter((c) => !c.cat);
    let fat;
    if (s.fatTab === 'atual') fat = { total: this.money(fatTotal), sub: s.faturaPaga ? 'Paga em 17/09 por transferência do Inter' : 'Ciclo de 19/08 a 18/09. Fecha amanhã, vence em 25/09', limPct: (fatTotal / 15000 * 100).toFixed(1) + '%', limTxt: this.money0(fatTotal) + ' usados de R$ 15.000 de limite', canPay: !s.faturaPaga, porCat: porCatArr.map(([n, v]) => ({ name: n, val: this.money0(v), w: (v / pcMax * 100).toFixed(1) + '%', bg: n === 'Sem classificação' ? '#EDB866' : accent })), hasUnclass: unclass.length > 0, unclassTxt: unclass.length + ' compras vindas da importação precisam de categoria', unclass: unclass.map((c) => ({ data: c.data, estab: c.desc, sug: c.sug, val: this.money(c.val), confirmar: () => { const cl = Object.assign({}, s.classif); cl[c.i] = c.sug.split(' (')[0]; this.setState({ classif: cl }); this.say('Categoria confirmada. Próximas compras de ' + c.desc.split('*')[1] + ' serão classificadas sozinhas'); } })), compras: fatAtual.filter((c) => c.cat).map((c) => ({ data: c.data, desc: c.desc, cat: c.cat, catColor: c.cat.startsWith('Investimentos') ? '#7FC8F8' : '#C9CBD1', cli: c.cli, val: this.money(c.val), assin: c.assin, hasParc: !!c.parc, parc: c.parc || '', open: () => this.say('Abriria a ficha da compra: mesma ficha das contas, com a leitura do custo') })) };
    else if (s.fatTab === 'proxima') fat = { total: 'R$ 1.681,73', sub: 'Já compromissado: assinaturas previstas e parcelas. Ciclo de 19/09 a 18/10, vence em 25/10', limPct: '11%', limTxt: 'Previsão, atualiza conforme as compras', canPay: false, porCat: [{ name: 'Softwares', val: 'R$ 1.466', w: '100%', bg: accent }, { name: 'Investimentos', val: 'R$ 216', w: '15%', bg: accent }], hasUnclass: false, unclass: [], unclassTxt: '', compras: [['20/09', 'Adobe, Creative Cloud', 449.9, true, null], ['22/09', 'Canva Teams', 299.9, true, null], ['25/09', 'Figma, plano profissional', 245, true, null], ['01/10', 'Notion', 132, true, null], ['03/10', 'Envato Elements', 189, true, null], ['05/10', 'Frame.io', 150, true, null], ['11/10', 'Amazon, microfone de lapela', 216.33, false, '3/3']].map((c) => ({ data: c[0], desc: c[1], cat: c[4] ? 'Investimentos › Equipamentos' : 'Softwares › Criação', catColor: '#C9CBD1', cli: 'Operação geral', val: this.money(c[2]), assin: c[3], hasParc: !!c[4], parc: c[4] || '', open: () => this.say('Compra prevista: gerada pela assinatura ou parcela') })) };
    else fat = { total: 'R$ 2.311,40', sub: 'Fatura de agosto, paga em 25/08 por transferência do Inter', limPct: '15%', limTxt: 'Julho: R$ 2.194,80. Junho: R$ 2.087,10', canPay: false, porCat: [{ name: 'Softwares', val: 'R$ 1.466', w: '100%', bg: accent }, { name: 'Transporte', val: 'R$ 412', w: '28%', bg: accent }, { name: 'Alimentação', val: 'R$ 433', w: '30%', bg: accent }], hasUnclass: false, unclass: [], unclassTxt: '', compras: [] };
    const fatTabs = [['atual', 'Fatura atual'], ['proxima', 'Próxima'], ['anteriores', 'Anteriores']].map(([k, label]) => ({ label, on: s.fatTab === k, border: s.fatTab === k ? accent : '#33363E', bg: s.fatTab === k ? 'rgba(169,155,255,0.12)' : 'transparent', fg: s.fatTab === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ fatTab: k }) }));

    const team = s.team.map((t) => {
      const ajCusto = t.aj.filter((a) => a.tipo !== 'Reembolso' && a.tipo !== 'Adiantamento').reduce((x, a) => x + a.val, 0);
      const ajTot = t.aj.reduce((x, a) => x + a.val, 0);
      return Object.assign({}, t, { ajCusto, ajTot, total: t.base + ajTot, custo: t.base + ajCusto });
    });
    const colabs = team.filter((t) => t.tipo !== 'Sócio');
    const socios = team.filter((t) => t.tipo === 'Sócio');
    const custoEq = colabs.reduce((a, t) => a + t.custo, 0);
    const nfOk = colabs.filter((t) => t.nf).length;
    const pagos = team.filter((t) => t.pago).length;
    const mkTm = (t) => {
      const nfNa = t.nf === null;
      let actLabel, act;
      if (t.pago) { actLabel = 'Comprovante'; act = () => this.say('Abriria o comprovante do pagamento'); }
      else if (!nfNa && !t.nf) { actLabel = 'Anexar NF'; act = () => { this.setState({ team: s.team.map((x) => x.id === t.id ? Object.assign({}, x, { nf: true }) : x) }); this.say('NF de ' + t.nome + ' anexada: ' + this.money(t.base + t.aj.filter((a) => a.tipo !== 'Adiantamento').reduce((x, a) => x + a.val, 0))); }; }
      else { actLabel = 'Pagar'; act = () => { this.setState({ team: s.team.map((x) => x.id === t.id ? Object.assign({}, x, { pago: true }) : x) }); this.say('Pagamento de ' + t.nome + ' registrado: ' + this.money(t.total) + '. Aguardando confirmação no extrato Inter'); }; }
      return {
        nome: t.nome, sub: t.funcao + ', ' + t.squad + ', ' + t.cc, base: this.money0(t.base),
        aj: t.aj.length ? (t.ajTot >= 0 ? '+ ' : '− ') + this.money0(Math.abs(t.ajTot)) : '—', ajColor: t.aj.length ? (t.ajTot >= 0 ? '#6FD3A2' : '#EDB866') : '#6E727B', ajDesc: t.aj.map((a) => a.tipo).join(', ') || 'adicionar',
        total: this.money0(t.total),
        nfTxt: nfNa ? 'Não se aplica' : t.nf ? 'Recebida' : 'Pendente', nfColor: nfNa ? '#6E727B' : t.nf ? '#6FD3A2' : '#EDB866', nfFill: t.nf ? '#6FD3A2' : 'transparent',
        payTxt: t.pago ? 'Pago em 17/09' : 'Programado 05/10', payColor: t.pago ? '#6FD3A2' : '#86B4F7',
        actLabel, act, open: () => this.setState({ colabId: t.id }), ajustar: () => this.setState({ ajusteFor: t.id, aForm: { tipo: 'Bônus', desc: '', valor: '' } })
      };
    };
    const byCc = (cc) => colabs.filter((t) => t.cc === cc);
    const fgroups = [['Entrega', byCc('Entrega')], ['Comercial', byCc('Comercial')], ['Administrativo', byCc('Administrativo')], ['Sócios, pró-labore', socios]].filter((g) => g[1].length).map(([n, ts]) => ({ name: n, sub: ts.length + (ts.length === 1 ? ' pessoa, ' : ' pessoas, ') + this.money0(ts.reduce((a, t) => a + t.total, 0)) + ' a pagar', rows: ts.map(mkTm) }));
    const pend = colabs.filter((t) => !t.nf);
    const fo = {
      custo: this.money0(custoEq), custoCtx: 'Com pró-labore: ' + this.money0(custoEq + socios.reduce((a, t) => a + t.custo, 0)) + '. Agosto: R$ 36.600',
      pctRec: Math.round(custoEq / 111860 * 100) + '%',
      nfs: nfOk + ' de ' + colabs.length, nfColor: nfOk < colabs.length ? '#EDB866' : '#6FD3A2', nfCtx: pend.length ? 'Pendentes: ' + pend.map((t) => t.nome.split(' ')[0]).join(' e ') : 'Todas recebidas',
      pagos: pagos + ' de ' + team.length, pagosCtx: 'Pagamento previsto para 05/10, conta Inter',
      groups: fgroups, totalPagar: this.money0(team.filter((t) => !t.pago).reduce((a, t) => a + t.total, 0)),
      steps: [['Valores conferidos', 'Contratos e ajustes do mês', true], ['NFs recebidas', nfOk + ' de ' + colabs.length, nfOk === colabs.length], ['Pagamentos feitos', pagos + ' de ' + team.length, pagos === team.length], ['Comprovantes anexados', pagos + ' de ' + team.length, pagos === team.length]].map(([t, d, done]) => ({ t, d, done, bg: done ? '#6FD3A2' : 'transparent', ring: done ? '#6FD3A2' : '#454852', border: done ? 'rgba(111,211,162,0.3)' : '#2C2F36' }))
    };

    const recsData = [
      ['Imobiliária Praia Mar', 'Aluguel do escritório', 'Estrutura › Aluguel', 4200, null, 'Dia 18', 'Boleto', 'Contrato até 03/2027', 'Administrativo', 'Ativa'],
      ['Receita Federal', 'DAS Simples Nacional', 'Impostos › DAS', 7140, 'pct', 'Dia 20', 'Guia DAS', 'Sem término', 'Administrativo', 'Ativa'],
      ['Receita Federal', 'INSS sobre pró-labore', 'Impostos › INSS pró-labore', 1210, 'last', 'Dia 20', 'Guia DARF', 'Sem término', 'Diretoria', 'Ativa'],
      ['Contabilidade Ágil', 'Honorários contábeis', 'Serviços › Contabilidade', 1400, null, 'Dia 10', 'PIX', 'Reajuste em janeiro', 'Administrativo', 'Ativa'],
      ['Vivo Empresas', 'Internet e telefonia', 'Estrutura › Internet', 489.90, null, 'Dia 28', 'Débito automático', 'Contrato até 11/2026', 'Administrativo', 'Ativa'],
      ['EDP', 'Energia elétrica', 'Estrutura › Energia', 310, 'avg3', 'Dia 18', 'Débito automático', 'Sem término', 'Administrativo', 'Ativa'],
      ['Adobe', 'Creative Cloud', 'Softwares › Criação', 449.90, null, 'Dia 20', 'Cartão Inter', 'Assinatura mensal', 'Entrega', 'Ativa'],
      ['Google', 'Workspace, 14 licenças', 'Softwares › Produtividade', 370.10, null, 'Dia 17', 'Boleto', 'Assinatura mensal', 'Administrativo', 'Ativa'],
      ['Canva', 'Canva Teams', 'Softwares › Criação', 299.90, null, 'Dia 22', 'Cartão Inter', 'Assinatura mensal', 'Entrega', 'Ativa'],
      ['Figma', 'Plano profissional', 'Softwares › Criação', 245, null, 'Dia 25', 'Cartão Inter', 'Renova em 11/2026', 'Entrega', 'Ativa'],
      ['Porto Seguro', 'Seguro de equipamentos', 'Estrutura › Seguros', 320, null, 'Dia 15', 'Boleto', 'Contrato até 10/2026', 'Entrega', 'Ativa'],
      ['Envato', 'Envato Elements', 'Softwares › Criação', 189, null, 'Dia 3', 'Cartão Inter', 'Assinatura mensal', 'Entrega', 'Ativa'],
      ['Frame.io', 'Revisão de vídeo', 'Softwares › Criação', 150, null, 'Dia 5', 'Cartão Inter', 'Assinatura mensal', 'Entrega', 'Ativa'],
      ['Notion', 'Workspace', 'Softwares › Produtividade', 132, null, 'Dia 1', 'Cartão Inter', 'Assinatura mensal', 'Administrativo', 'Ativa']
    ];
    const metodoTxt = { pct: '6% da receita', last: 'último valor', avg3: 'média de 3 meses' };
    const rFilters = { todas: () => true, est: (r) => !!r[4], soft: (r) => r[2].startsWith('Softwares'), cartao: (r) => r[6].startsWith('Cartão') };
    const recFiltered = recsData.map((r, i) => [r, i]).filter(([r]) => rFilters[s.recFiltro](r));
    const fixoOutros = recsData.reduce((a, r) => a + r[3], 0);
    const folhaFixa = team.reduce((a, t) => a + t.base, 0);
    const rc = {
      custoFixo: this.money0(fixoOutros + folhaFixa), custoFixoSub: 'Folha ' + this.money0(folhaFixa) + ' + demais ' + this.money0(fixoOutros),
      cobertura: Math.round(96400 / (fixoOutros + folhaFixa) * 100) + '%', ativas: String(recsData.length), estimadas: String(recsData.filter((r) => r[4]).length),
      filtros: [['todas', 'Todas'], ['est', 'Estimadas'], ['soft', 'Softwares e assinaturas'], ['cartao', 'No cartão']].map(([k, label]) => ({ label, on: s.recFiltro === k, border: s.recFiltro === k ? accent : '#33363E', bg: s.recFiltro === k ? 'rgba(169,155,255,0.12)' : '#22252B', fg: '#EEEEF0', pick: () => this.setState({ recFiltro: k }) })),
      rows: recFiltered.map(([r, i]) => ({ forn: r[0], desc: r[1], vig: r[7], cat: r[2], val: (r[4] ? '~ ' : '') + this.money(r[3]), valStyle: r[4] ? 'italic' : 'normal', valColor: r[4] ? '#C9CBD1' : '#EEEEF0', metodo: r[4] ? 'estimado, ' + metodoTxt[r[4]] : 'fixo', dia: r[5], forma: r[6], status: r[9], stFg: '#6FD3A2', stBg: 'rgba(111,211,162,0.13)', open: () => this.setState({ recIdx: i }) }))
    };

    const fornData = [
      ['Receita Federal', 'Órgão público', 'Impostos › DAS', 92400, '+14%', 'Guia', null, 'Impostos'],
      ['Imobiliária Praia Mar', 'Fornecedor', 'Estrutura › Aluguel', 50400, '+5%', 'Boleto', null, 'Fornecedor'],
      ['Contabilidade Ágil', 'Fornecedor', 'Serviços › Contabilidade', 16800, '0%', 'PIX, CNPJ', null, 'Fornecedor'],
      ['LocaCine Equipamentos', 'Fornecedor', 'Custos diretos › Locação de equipamento', 14300, '+38%', 'Boleto', null, 'Fornecedor'],
      ['Lucas Prado', 'Freelancer', 'Custos diretos › Freelancers', 11100, '+22%', 'PIX, CNPJ', null, 'Freelancer'],
      ['Marina Costa', 'Freelancer', 'Custos diretos › Freelancers', 9600, '+60%', 'PIX, e-mail', null, 'Freelancer'],
      ['Pedro Alves', 'Freelancer', 'Custos diretos › Freelancers', 6650, '−8%', 'PIX, e-mail', null, 'Freelancer'],
      ['Vivo Empresas', 'Fornecedor', 'Estrutura › Internet', 5879, '+3%', 'Débito automático', null, 'Fornecedor'],
      ['Estúdio Som Norte', 'Fornecedor', 'Custos diretos › Produção de áudio', 5400, 'novo', 'PIX, e-mail', null, 'Fornecedor'],
      ['Adobe', 'Fornecedor', 'Softwares › Criação', 5399, '+12%', 'Cartão Inter', null, 'Fornecedor'],
      ['Google', 'Fornecedor', 'Softwares › Produtividade', 4441, '+9%', 'Boleto', null, 'Fornecedor'],
      ['Kabum', 'Fornecedor', 'Investimentos › Equipamentos', 4300, '−40%', 'PIX', null, 'Fornecedor'],
      ['Gráfica Rápida ES', 'Fornecedor', 'Custos diretos › Impressão e materiais', 3900, '+18%', '—', 'sem dados', 'Fornecedor'],
      ['EDP', 'Fornecedor', 'Estrutura › Energia', 3720, '+7%', 'Débito automático', null, 'Fornecedor']
    ];
    const tipoMap = { todos: null, forn: 'Fornecedor', free: 'Freelancer', org: 'Órgão público' };
    const fornTipos = [['todos', 'Todos'], ['forn', 'Fornecedores'], ['free', 'Freelancers'], ['org', 'Órgãos públicos']].map(([k, label]) => ({ label, on: s.fornTipo === k, bg: s.fornTipo === k ? '#2C2F36' : 'transparent', fg: s.fornTipo === k ? '#EEEEF0' : '#A6A9B1', pick: () => this.setState({ fornTipo: k }) }));
    const fornRows = fornData.filter((f) => !tipoMap[s.fornTipo] || f[1] === tipoMap[s.fornTipo]).map((f) => {
      const ps = P.filter((p) => p.forn === f[0] && !p.dv.paid && p.kind === 'conta');
      const ab = ps.reduce((a, p) => a + p.dv.saldo, 0); const venc = ps.some((p) => p.dv.overdue);
      const nx = ps.filter((p) => !p.dv.overdue).sort((a, b) => a.dv.diff - b.dv.diff)[0];
      return { nome: f[0], inc: !!f[6], tipo: f[1], cat: f[2], gasto: this.money0(f[3]), vari: f[4] === 'novo' ? 'novo este ano' : f[4] + ' vs. 12 meses anteriores', varColor: f[4].startsWith('+') && parseInt(f[4].slice(1), 10) >= 20 ? '#EDB866' : '#A6A9B1', aberto: ab ? this.money0(ab) : '—', abColor: venc ? '#F08A84' : '#EEEEF0', prox: nx ? this.dd(nx.d) + '/' + this.dd(nx.m) + ', ' + this.money0(nx.dv.saldo) : '—', forma: f[5], open: () => this.setState({ fornNome: f[0] }) };
    });

    let f = { itens: [], payData: [], hist6: [], mesmaCat: [], docs: [], baixas: [], hist: [] };
    const fp = P.find((p) => p.id === s.fichaId);
    if (fp) {
      const dv = fp.dv; const ci = CATS[fp.cat] || { orc: 0, real: 0, dre: fp.cat, imp: 'opex' };
      const payData = [];
      if (fp.codigo) payData.push({ label: fp.forma === 'PIX' ? 'Chave PIX' : 'Linha digitável', value: fp.codigo, copy: () => this.say('Copiado para colar no app do banco') });
      if (fp.codigo && fp.forma === 'PIX') payData.push({ label: 'Favorecido', value: fp.forn + (fp.forn.includes(' ') && !fp.forn.includes('Estúdio') ? '' : ''), copy: () => this.say('Nome do favorecido copiado') });
      if (fp.codigo && fp.forma !== 'PIX') payData.push({ label: 'Valor', value: this.money(dv.saldo), copy: () => this.say('Valor copiado') });
      const orcPct = ci.orc ? ci.real / ci.orc : 0;
      const baseV = fp.valor; const hvals = fp.rec ? [0.92, 0.95, 0.97, 1, 0.98, 1].map((k) => baseV * k) : fp.cat.includes('Freelancers') ? [650, 1400, 900, 1850, 1200, baseV] : [];
      const hmax = Math.max(1, ...hvals);
      const others = P.filter((p) => p.cat === fp.cat && p.id !== fp.id && p.m === fp.m);
      const docDef = [['boleto', fp.forma === 'PIX' ? 'Cobrança do fornecedor' : 'Boleto ou fatura', false], ['nf', 'NF do fornecedor', fp.needsNF], ['comp', 'Comprovante', false]];
      const hist = [];
      if (fp.pagoEm) hist.push({ d: fp.pagoEm, t: 'Pagamento registrado' + (fp.conc ? ' e confirmado no extrato' : ', aguardando confirmação no extrato') });
      if (fp.prog) hist.push({ d: '12/09', t: 'Pagamento programado para ' + this.dd(fp.prog) + '/' + this.dd(fp.m) + ' por Iago Lima' });
      if (fp.est) hist.push({ d: '01/09', t: 'Valor estimado em ' + this.money(fp.valor) + ' (' + fp.metodo + ')' });
      if (fp.favDiv) hist.push({ d: '12/09', t: 'Boleto lido: favorecido "PagFácil Intermediações Ltda" diferente do CNPJ do fornecedor' });
      hist.push({ d: '01/09', t: fp.origem });
      f = {
        kind: fp.cat.startsWith('Investimentos') ? 'Conta a pagar, investimento' : 'Conta a pagar', forn: fp.forn, desc: fp.desc,
        valTxt: (fp.est && !dv.paid ? '~ ' : '') + this.money(dv.paid ? fp.valor : dv.saldo), valStyle: fp.est && !dv.paid ? 'italic' : 'normal',
        sub: dv.paid ? 'Pago em ' + fp.pagoEm : fp.est ? 'Estimado: ' + fp.metodo : dv.overdue ? 'Vencida há ' + dv.dias + ' dias. Encargos, se houver, são informados no pagamento' : 'Valor da parcela', subColor: fp.est || dv.overdue ? '#EDB866' : '#A6A9B1',
        chip: dv.chip, chipFg: dv.fg, chipBg: dv.bg, payTxt: dv.payTxt, payFg: dv.payFg, origem: fp.origem,
        goOrigem: () => { if (fp.rec) { const i = recsData.findIndex((r) => fp.desc.toLowerCase().includes(r[1].split(',')[0].toLowerCase().slice(0, 8)) || r[0] === fp.forn); this.setState({ fichaId: null, tab: 'rec', recIdx: i >= 0 ? i : null }); } else this.say(fp.origem.startsWith('Veio da Operação') ? 'Abriria a solicitação na Operação' : 'Abriria a origem do lançamento'); },
        openForn: () => this.setState({ fornNome: fp.forn }),
        canPay: !dv.paid, paid: dv.paid,
        primaryLabel: fp.est ? 'Informar valor real' : fp.forma === 'Débito automático' ? 'Confirmar débito' : 'Registrar pagamento',
        primary: fp.est ? () => this.setState({ valorId: fp.id, vForm: { valor: '', codigo: '' } }) : () => this.abrirPagar(fp),
        programar: () => this.say('Abriria a programação: escolher a data e ver o saldo projetado da conta nesse dia'),
        editar: () => this.say(fp.rec ? 'Editar perguntaria: só esta conta ou esta e as próximas (altera a recorrência)' : 'Abriria a edição da conta'),
        more: () => this.say('Menu: alterar vencimento, informar valor real, duplicar, cancelar, estornar pagamento'),
        hasPayData: payData.length > 0, payData, favDiv: fp.favDiv,
        noPayData: payData.length === 0 && !dv.paid && fp.forma !== 'Débito automático', noPayTxt: fp.est ? 'Guia ainda não emitida. Informe o valor real quando ela sair, com o código de barras.' : 'Sem dados de pagamento. Adicione o código do boleto ou a chave PIX.', addPayLabel: fp.est ? 'Informar valor real' : 'Adicionar dados', addPayData: fp.est ? () => this.setState({ valorId: fp.id, vForm: { valor: '', codigo: '' } }) : () => this.say('Abriria os dados de pagamento'),
        venc: this.dd(fp.d) + '/' + this.dd(fp.m) + '/2026', prog: fp.prog ? this.dd(fp.prog) + '/' + this.dd(fp.m) + '/2026' : (fp.forma === 'Débito automático' ? 'Débito no vencimento' : 'Não programada'), progColor: fp.prog || fp.forma === 'Débito automático' ? '#EEEEF0' : '#EDB866',
        comp: fp.desc.includes('agosto') ? 'Agosto 2026' : fp.m === 10 ? 'Outubro 2026' : 'Setembro 2026', conta: fp.forma === 'Débito automático' ? 'Inter (débito)' : fp.conta, forma: fp.forma, parcTxt: fp.parc ? fp.parc[0] + ' de ' + fp.parc[1] : 'Única',
        itens: [{ cat: fp.cat, dims: 'Centro de custo ' + fp.cc + (fp.cli ? ', cliente ' + fp.cli : ', Operação geral'), val: this.money(fp.valor) }],
        dre: ci.dre,
        orcTxt: ci.orc ? this.money0(ci.real) + ' de ' + this.money0(ci.orc) + ' no mês (' + Math.round(orcPct * 100) + '%)' + (orcPct > 1.1 ? ', acima da tolerância' : '') : 'Sem orçamento para esta categoria', orcW: Math.min(100, orcPct * 100).toFixed(1) + '%', orcBg: orcPct > 1.1 ? '#EDB866' : orcPct > 1 ? '#EDB866' : accent,
        rent: ci.imp === 'direto' ? (fp.cli ? 'Custo direto de ' + fp.cli + ': reduz a margem de contribuição do cliente em ' + this.money0(fp.valor) : 'Custo de entrega em Operação geral') : ci.imp === 'invest' ? 'Não afeta: investimento fica fora da DRE' : ci.imp === 'deducao' ? 'Distribuído entre os clientes pela alíquota efetiva' : 'Despesa de estrutura, não é distribuída entre clientes',
        hist6: hvals.map((v, i) => ({ h: String(Math.max(4, Math.round(v / hmax * 42))), bg: i === hvals.length - 1 ? accent : '#4A4E58', t: this.money(v) })),
        histTxt: hvals.length ? (fp.rec ? 'Estável: variação de até 8% em 6 meses' : 'Maior valor pago a este fornecedor nos últimos 6 meses') : 'Sem histórico comparável', histColor: hvals.length && !fp.rec && fp.valor >= hmax ? '#EDB866' : '#A6A9B1',
        mesmaCat: others.slice(0, 4).map((o) => ({ t: o.forn + ', ' + o.desc.toLowerCase(), v: this.money0(o.valor), open: () => this.setState({ fichaId: o.id }) })),
        mesmaTot: 'Total da categoria no mês: ' + this.money0(fp.valor + others.reduce((a, o) => a + o.valor, 0)),
        docs: docDef.map(([k, t, req]) => { const has = fp.docs[k]; return { t, sub: has ? 'Anexado' : req ? 'Obrigatório antes de pagar' : 'Pendente, clique para anexar', subColor: has ? '#6FD3A2' : req ? '#EDB866' : '#A6A9B1', ring: has ? '#6FD3A2' : req ? '#EDB866' : '#454852', fill: has ? '#6FD3A2' : 'transparent', border: has ? 'rgba(111,211,162,0.4)' : req ? 'rgba(237,184,102,0.45)' : '#454852', bstyle: has ? 'solid' : 'dashed', toggle: () => { this.updP(fp.id, (p) => ({ docs: Object.assign({}, p.docs, { [k]: !p.docs[k] }) })); if (!has) this.say(t + ' anexado'); } }; }),
        noBaixa: fp.baixas.length === 0, baixas: fp.baixas.map((b) => ({ data: b.data, desc: b.desc, val: this.money(b.val), conc: b.conc ? 'Confirmado no extrato' : 'Aguardando confirmação no extrato', concFg: b.conc ? '#6FD3A2' : '#A6A9B1' })), hist
      };
    }

    let cb = { slots: [], clientes: [], c12m: [], versoes: [] };
    const tc = team.find((t) => t.id === s.colabId);
    if (tc) {
      const used = tc.clientes.length; const cap = tc.cap; const div = Math.max(cap, used);
      const vaga = cap ? tc.base / div : 0; const ocioN = cap ? Math.max(0, cap - used) : 0;
      const slots = []; for (let i = 0; i < Math.max(cap, used); i++) slots.push({ t: i < used ? tc.clientes[i] : 'Vaga livre', bg: i < used ? accent : 'transparent', border: i < used ? accent : '#6E727B' });
      const ms = ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
      const vals = ms.map((m, i) => i < 5 ? tc.base * 0.92 : tc.base + (i === 11 ? tc.ajCusto : i === 8 ? 300 : 0));
      const mx = Math.max(...vals);
      const slug = tc.nome.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').split(' ')[0];
      cb = {
        nome: tc.nome, tipo: tc.tipo === 'Sócio' ? 'Sócio' : 'Colaborador PJ', sub: tc.funcao + ', ' + tc.squad + '. Centro de custo ' + tc.cc,
        base: this.money0(tc.base), c12: this.money0(vals.reduce((a, v) => a + v, 0)), desde: tc.desde,
        hasAloc: cap > 0, cap: String(cap), vaga: this.money0(vaga) + ' por cliente', ocio: ocioN ? ocioN + (ocioN === 1 ? ' vaga, ' : ' vagas, ') + this.money0(ocioN * vaga) : (used > cap ? 'Acima da capacidade' : 'Nenhuma'), ocioColor: used > cap ? '#F08A84' : ocioN ? '#EDB866' : '#6FD3A2',
        slots, slotsTxt: used + ' de ' + cap + ' vagas ocupadas. As vagas livres viram capacidade ociosa na rentabilidade.', clientes: tc.clientes.map((n) => ({ n })),
        c12m: vals.map((v, i) => ({ m: ms[i], h: String(Math.round(v / mx * 70)), bg: i === 11 ? accent : '#4A4E58', t: this.money(v) })),
        razao: tc.nome + (tc.tipo === 'Sócio' ? '' : ' Serviços Criativos ME'), cnpj: tc.tipo === 'Sócio' ? 'CPF do sócio' : '4' + tc.id.slice(1) + '.512.330/0001-' + this.dd(10 + parseInt(tc.id.slice(1), 10)),
        dataBase: tc.desde.split('/')[0] === 'fundação' ? '—' : tc.desde.split('/')[0].charAt(0).toUpperCase() + tc.desde.split('/')[0].slice(1), cc: tc.cc, pix: tc.tipo === 'Sócio' ? 'CPF' : 'CNPJ da PJ, ' + slug + '@pix',
        versoes: [{ d: '01/05/2026', t: 'Reajuste anual', v: this.money0(tc.base) }, { d: tc.desde, t: 'Início do contrato', v: this.money0(Math.round(tc.base * 0.92 / 50) * 50) }],
        ajustar: () => this.setState({ ajusteFor: tc.id, aForm: { tipo: 'Bônus', desc: '', valor: '' } })
      };
    }

    let fn = { bars: [], jobs: [], contas: [] };
    const fdd = fornData.find((x) => x[0] === s.fornNome);
    if (fdd) {
      const ps = P.filter((p) => p.forn === fdd[0] && p.m === s.mes && p.kind === 'conta');
      const ms = ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
      const seed = fdd[3] / 12; const vals = ms.map((m, i) => Math.max(0, seed * (0.6 + ((i * 37) % 9) / 10)));
      const mx = Math.max(...vals);
      const isFreela = fdd[1] === 'Freelancer';
      fn = {
        nome: fdd[0], tipo: fdd[1], sub: 'Categoria principal: ' + fdd[2], inc: !!fdd[6],
        gasto: this.money0(fdd[3]), media: this.money0(fdd[3] / 12), aberto: this.money0(ps.filter((p) => !p.dv.paid).reduce((a, p) => a + p.dv.saldo, 0)),
        bars: vals.map((v, i) => ({ m: ms[i], h: String(Math.max(3, Math.round(v / mx * 70))), op: i === 11 ? '1' : '0.55', t: this.money0(v) })),
        isFreela, jobs: isFreela ? [{ c: 'Restaurante Sabor do Mar', n: '5 jobs', v: this.money0(fdd[3] * 0.45) }, { c: 'Grupo Orla', n: '3 jobs', v: this.money0(fdd[3] * 0.33) }, { c: 'Clínica Vitta', n: '2 jobs', v: this.money0(fdd[3] * 0.22) }] : [],
        forma: fdd[5], pix: fdd[6] ? 'Não informada' : fdd[5].startsWith('PIX') ? (fdd[5].includes('CNPJ') ? 'CNPJ do fornecedor' : 'E-mail cadastrado') : '—', pixColor: fdd[6] ? '#EDB866' : '#EEEEF0',
        razao: fdd[0] + (fdd[1] === 'Freelancer' ? ' (MEI)' : ' Ltda'), cnpj: '12.' + (300 + fdd[3] % 600) + '.884/0001-' + this.dd(fdd[3] % 90 + 10), cat: fdd[2], cc: fdd[2].startsWith('Custos') ? 'Entrega' : 'Administrativo', exigeNf: isFreela || fdd[2].includes('Freelancers') ? 'Sim' : 'Não',
        contas: ps.map((p) => ({ desc: p.desc, venc: this.dd(p.d) + '/' + this.dd(p.m), chip: p.dv.chip, chipFg: p.dv.fg, chipBg: p.dv.bg, val: this.money0(p.valor), open: () => this.setState({ fornNome: null, fichaId: p.id }) })), noContas: ps.length === 0,
        novaDespesa: () => { const nd = this.ndInit(fdd[0]); nd.itens = [{ cat: fdd[2].startsWith('Impostos') ? 'Serviços › Contabilidade' : fdd[2], cli: '', val: '' }]; nd.forma = fdd[5].startsWith('PIX') ? 'PIX' : fdd[5].startsWith('Cartão') ? 'Cartão de crédito' : 'Boleto'; this.setState({ fornNome: null, novaOpen: true, nd }); }
      };
    }

    let rv = { bars: [] };
    if (s.recIdx !== null && recsData[s.recIdx]) {
      const r = recsData[s.recIdx]; const est = !!r[4];
      const ms = ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
      const vals = ms.map((m, i) => est ? r[3] * (0.82 + ((i * 29) % 7) / 20) : (i < 7 ? r[3] * 0.95 : r[3]));
      if (est) vals[11] = r[3];
      const mx = Math.max(...vals);
      rv = { forn: r[0], desc: r[1], val: (est ? '~ ' : '') + this.money(r[3]), valStyle: est ? 'italic' : 'normal', metodo: est ? 'por mês, estimado pela ' + metodoTxt[r[4]] : 'por mês, valor fixo', cat: r[2], dia: r[5], forma: r[6], vig: r[7], cc: r[8], metodoLong: est ? (r[4] === 'pct' ? '6% da receita bruta do mês anterior (alíquota efetiva informada)' : metodoTxt[r[4]].charAt(0).toUpperCase() + metodoTxt[r[4]].slice(1)) : 'Valor fixo',
        bars: vals.map((v, i) => ({ m: ms[i], h: String(Math.round(v / mx * 90)), bg: i === 11 && est ? 'transparent' : '#4A4E58', border: i === 11 ? accent : 'transparent', bstyle: i === 11 && est ? 'dashed' : 'solid', t: this.money(v) })),
        barsTxt: est ? 'Setembro tracejado: valor estimado, ainda não confirmado. Os demais são valores reais pagos.' : 'Valores pagos. Aumento em maio: reajuste anual.' };
    }

    const nd = s.nd; const ndTipo = nd.tipo;
    const ndVals = nd.itens.map((it) => this.parse(it.val)); const ndTotal = ndVals.reduce((a, b) => a + b, 0);
    const ndItens = nd.itens.map((it, i) => {
      const ci = CATS[it.cat] || {}; const direto = ci.imp === 'direto'; const falta = direto && !it.cli;
      return { cat: it.cat, cli: it.cli, val: it.val, cliBorder: falta ? '#EDB866' : '#373A43',
        hint: falta ? 'Custo direto: escolha o cliente ou projeto (ou Operação geral)' : direto ? 'Entra como custo direto de ' + it.cli : ci.imp === 'invest' ? 'Investimento: fica fora da DRE, aparece em Investimentos' : 'Despesa de estrutura, centro de custo sugerido: Administrativo', hintColor: falta ? '#EDB866' : '#A6A9B1',
        onCat: (e) => { const a = nd.itens.slice(); a[i] = Object.assign({}, a[i], { cat: e.target.value }); this.setNd({ itens: a }); },
        onCli: (e) => { const a = nd.itens.slice(); a[i] = Object.assign({}, a[i], { cli: e.target.value }); this.setNd({ itens: a }); },
        onVal: (e) => { const a = nd.itens.slice(); a[i] = Object.assign({}, a[i], { val: e.target.value }); this.setNd({ itens: a }); },
        remove: () => { if (nd.itens.length > 1) this.setNd({ itens: nd.itens.filter((_, j) => j !== i) }); } };
    });
    const ndCartao = nd.forma === 'Cartão de crédito';
    const tipos = [['unica', 'Única', 'Um vencimento'], ['parcelada', 'Parcelada', 'Compra em parcelas'], ['recorrente', 'Recorrente', 'Custo fixo, assinatura']].map(([k, label, sub]) => ({ label, sub, on: ndTipo === k, border: ndTipo === k ? accent : '#2C2F36', bg: ndTipo === k ? 'rgba(169,155,255,0.08)' : '#191B1F', pick: () => this.setNd({ tipo: k }) }));
    const fornDef = { 'LocaCine Equipamentos': ['Custos diretos › Locação de equipamento', 'Boleto'], 'Marina Costa': ['Custos diretos › Freelancers', 'PIX'], 'Lucas Prado': ['Custos diretos › Freelancers', 'PIX'], 'Pedro Alves': ['Custos diretos › Freelancers', 'PIX'], 'Estúdio Som Norte': ['Custos diretos › Produção de áudio', 'PIX'], 'Imobiliária Praia Mar': ['Estrutura › Aluguel', 'Boleto'], 'Contabilidade Ágil': ['Serviços › Contabilidade', 'PIX'], 'Gráfica Rápida ES': ['Custos diretos › Impressão e materiais', 'Transferência'], 'Adobe': ['Softwares › Criação', 'Cartão de crédito'], 'Kabum': ['Investimentos › Equipamentos', 'PIX'] };
    const cat0 = nd.itens[0].cat; const ci0 = CATS[cat0] || { orc: 0, real: 0, imp: 'opex' };
    const pvErros = [];
    if (!nd.forn) pvErros.push({ t: 'Escolher o fornecedor' });
    if (ndTotal <= 0) pvErros.push({ t: 'Informar o valor' });
    if (nd.itens.some((it) => (CATS[it.cat] || {}).imp === 'direto' && !it.cli)) pvErros.push({ t: 'Cliente ou projeto do custo direto' });
    const pvParcs = [];
    let pvTitulo, pvSub;
    if (ndCartao) {
      const n = parseInt(nd.parcCartao, 10); const d = this.pd(nd.compra); const fech = d.getDate() <= 18 ? d.getMonth() : d.getMonth() + 1;
      for (let i = 0; i < Math.min(n, 3); i++) { const mm = fech + i; const dt = new Date(2026, mm, 25); pvParcs.push({ n: n > 1 ? (i + 1) + '/' + n : '1', venc: 'Fatura que vence em ' + this.fd(dt), comp: 'Competência ' + this.compOf(d) + ' (data da compra)', val: this.money(ndTotal / n), bstyle: i === 0 ? 'solid' : 'dashed' }); }
      pvTitulo = 'Compra no cartão Inter'; pvSub = this.money(ndTotal) + (n > 1 ? ' em ' + n + 'x' : ' à vista') + (nd.forn ? ', ' + nd.forn : '');
    } else if (ndTipo === 'parcelada') {
      const n = parseInt(nd.nParc, 10); const d0 = this.pd(nd.venc);
      for (let i = 0; i < n; i++) { const d = new Date(d0.getFullYear(), d0.getMonth() + i, d0.getDate()); if (i < 3 || i === n - 1) pvParcs.push({ n: (i + 1) + '/' + n, venc: 'Vence em ' + this.fd(d), comp: 'Competência ' + this.compOf(d0) + ' (toda no mês da compra)', val: this.money(ndTotal / n), bstyle: 'solid' }); }
      pvTitulo = n + ' parcelas de ' + this.money(ndTotal / n); pvSub = 'Total de ' + this.money(ndTotal);
    } else if (ndTipo === 'recorrente') {
      const d0 = this.pd(nd.venc); const est = nd.valorTipo !== 'fixo';
      for (let i = 0; i < 3; i++) { const d = new Date(d0.getFullYear(), d0.getMonth() + i, d0.getDate()); pvParcs.push({ n: String(i + 1), venc: 'Vence em ' + this.fd(d), comp: est ? 'Valor estimado, confirmar quando chegar' : 'Competência ' + this.compOf(d), val: (est ? '~ ' : '') + this.money(ndTotal), bstyle: i === 0 ? 'solid' : 'dashed' }); }
      pvTitulo = 'Custo recorrente de ' + (est ? '~ ' : '') + this.money(ndTotal) + ' por mês'; pvSub = 'Custo fixo mensal sobe ' + this.money0(ndTotal);
    } else {
      const d = this.pd(nd.venc);
      pvParcs.push({ n: '1', venc: 'Vence em ' + this.fd(d) + (nd.prog ? ', programada para ' + this.fd(this.pd(nd.prog)) : ''), comp: 'Competência ' + this.compOf(d), val: this.money(ndTotal), bstyle: 'solid' });
      pvTitulo = 'Uma conta a pagar'; pvSub = this.money(ndTotal) + (nd.forn ? ', ' + nd.forn : '');
    }
    const linhas = [];
    nd.itens.forEach((it) => { const ci = CATS[it.cat] || {}; if (ci.imp === 'direto' && it.cli) linhas.push({ t: 'Rentabilidade: custo direto de ' + it.cli + ' em setembro.' }); if (ci.imp === 'invest') linhas.push({ t: 'Investimento: não entra no resultado, aparece em Investimentos do período.' }); });
    if (!ndCartao && ndTotal > 0) linhas.push({ t: 'Caixa: sai do Inter em ' + this.fd(this.pd(nd.prog || nd.venc)) + '. Saldo projetado nesse dia: R$ 93.550.' });
    if (ndCartao) linhas.push({ t: 'Caixa: entra na fatura do cartão. A fatura é paga por transferência, sem contar a despesa de novo.' });
    if ((CATS[cat0] || {}).exigeNf) linhas.push({ t: 'Esta categoria exige NF antes do pagamento.' });
    if (nd.reemb) linhas.push({ t: 'Reembolso: o valor entra como ajuste na folha do colaborador.' });
    const orcAfter = ci0.orc ? (ci0.real + ndTotal) / ci0.orc : 0;
    const pv = { titulo: pvTitulo, sub: pvSub, parcs: pvParcs, hasOrc: ci0.orc > 0 && ci0.imp !== 'invest', orcCat: cat0.split(' › ')[0].toLowerCase(), orcTxt: Math.round(ci0.real / (ci0.orc || 1) * 100) + '% → ' + Math.round(orcAfter * 100) + '%', orcColor: orcAfter > 1.1 ? '#EDB866' : accent, orcAntes: Math.min(100, ci0.real / (ci0.orc || 1) * 100).toFixed(1) + '%', orcNovo: Math.max(0, Math.min(100, orcAfter * 100) - Math.min(100, ci0.real / (ci0.orc || 1) * 100)).toFixed(1) + '%', linhas, erros: pvErros, hasErr: pvErros.length > 0 };
    const doSave = (mode) => {
      if (pvErros.length) { this.say('Ainda falta: ' + pvErros.map((e) => e.t.toLowerCase()).join(', ')); return; }
      if (ndCartao) { this.setState({ compras: s.compras.concat([[this.dd(this.pd(nd.compra).getDate()) + '/' + this.dd(this.pd(nd.compra).getMonth() + 1), (nd.forn || 'Compra') + ', ' + (nd.desc || 'compra no cartão'), cat0, nd.itens[0].cli || 'Operação geral', ndTotal / parseInt(nd.parcCartao, 10), false, nd.parcCartao !== '1' ? '1/' + nd.parcCartao : null]]), novaOpen: mode === 'outra', nd: this.ndInit(mode === 'outra' ? nd.forn : ''), tab: 'contas', chip: 'cartao', fatTab: 'atual' }); this.say('Compra lançada na fatura atual do cartão Inter'); return; }
      const d = this.pd(nd.venc); const paga = mode === 'paga';
      const novo = { id: 200 + s.parcels.length, m: d.getMonth() + 1, d: d.getDate(), pago: paga ? ndTotal : 0, pagoEm: paga ? '17/09' : null, kind: 'conta', rec: ndTipo === 'recorrente', parc: ndTipo === 'parcelada' ? [1, parseInt(nd.nParc, 10)] : null, cli: nd.itens[0].cli && nd.itens[0].cli !== 'Operação geral' ? nd.itens[0].cli : null, conta: 'Inter', prog: nd.prog ? this.pd(nd.prog).getDate() : null, est: ndTipo === 'recorrente' && nd.valorTipo !== 'fixo', metodo: nd.valorTipo === 'fixo' ? null : 'estimado', forma: nd.forma, codigo: nd.codigo || null, favDiv: false, docs: { boleto: nd.boleto, nf: nd.nf, comp: paga }, needsNF: !!(CATS[cat0] || {}).exigeNf, conc: false, baixas: paga ? [{ data: '17/09', desc: 'Registrado no cadastro, conta Inter', val: ndTotal, conc: false }] : [], origem: nd.lido ? 'Lido do boleto enviado hoje' : 'Criada manualmente por Iago Lima', cc: (CATS[cat0] || {}).imp === 'direto' ? 'Entrega' : 'Administrativo', forn: nd.forn, desc: nd.desc || cat0.split(' › ').pop(), valor: ndTotal, cat: cat0 };
      this.setState({ parcels: s.parcels.concat([novo]), novaOpen: mode === 'outra', nd: this.ndInit(mode === 'outra' ? nd.forn : ''), tab: 'contas', chip: null, mes: novo.m, view: paga ? 'pagas' : 'aberto' });
      this.say(paga ? 'Despesa lançada como paga, aguardando confirmação no extrato' : 'Conta a pagar criada para ' + this.dd(novo.d) + '/' + this.dd(novo.m));
    };

    const pp = P.find((p) => p.id === s.pagarId);
    let pg = {}; let pgOpts = [];
    if (pp) {
      const dv = pp.dv; const v = this.parse(s.pForm.valor); const dif = dv.saldo - v;
      const nfFalta = pp.needsNF && !pp.docs.nf;
      pg = { sub: pp.forn + ', ' + pp.desc.toLowerCase() + '. Saldo de ' + this.money(dv.saldo), atrasada: dv.overdue, dias: dv.dias + ' dias', menor: dif > 0.009, difTxt: 'O valor cobre ' + this.money(Math.max(0, v)) + '. Faltam ' + this.money(dif) + '.', nfFalta,
        compTxt: s.pForm.comp ? 'Comprovante anexado: comprovante_pix_' + pp.id + '.pdf' : 'Arraste o comprovante aqui ou clique para escolher', compBorder: s.pForm.comp ? '#6FD3A2' : '#454852', compBg: s.pForm.comp ? 'rgba(111,211,162,0.07)' : 'transparent', compFg: s.pForm.comp ? '#6FD3A2' : '#A6A9B1' };
      pgOpts = [['manter', 'Manter ' + this.money(dif) + ' em aberto (pagamento parcial)'], ['desconto', 'Desconto obtido de ' + this.money(dif) + ' e quitar']].map(([k, label]) => ({ label, on: s.pForm.modo === k, border: s.pForm.modo === k ? accent : '#2C2F36', bg: s.pForm.modo === k ? 'rgba(169,155,255,0.07)' : 'transparent', dot: s.pForm.modo === k ? accent : '#454852', fill: s.pForm.modo === k ? accent : 'transparent', pick: () => this.setP({ modo: k }) }));
    }
    const confirmarPag = () => {
      if (!pp) return; const dv = pp.dv; const v = this.parse(s.pForm.valor);
      if (v <= 0) { this.say('Informe um valor maior que zero'); return; }
      if (pp.needsNF && !pp.docs.nf && !s.pForm.just.trim()) { this.say('Anexe a NF ou escreva a justificativa para pagar sem ela'); return; }
      const quita = dv.saldo - v > 0.009 && s.pForm.modo === 'desconto';
      const dt = this.pd(s.pForm.data); const dtxt = this.dd(dt.getDate()) + '/' + this.dd(dt.getMonth() + 1);
      this.updP(pp.id, (p) => ({ pago: quita ? p.valor : p.pago + Math.min(v, dv.saldo), pagoEm: dtxt, conta: s.pForm.conta, docs: Object.assign({}, p.docs, { comp: s.pForm.comp || p.docs.comp }), baixas: p.baixas.concat([{ data: dtxt, desc: (p.forma === 'Débito automático' ? 'Débito automático' : p.forma) + ', conta ' + s.pForm.conta + (quita ? ', desconto obtido de ' + this.money(dv.saldo - v) : '') + (s.pForm.just ? '. Sem NF: ' + s.pForm.just : ''), val: v, conc: false }]) }));
      this.setState({ pagarId: null });
      this.say('Pagamento registrado: ' + pp.forn + ', ' + this.money(v) + (s.pForm.comp ? ', com comprovante' : ', sem comprovante') + '. Aguardando confirmação no extrato ' + s.pForm.conta);
    };

    const vp = P.find((p) => p.id === s.valorId);
    let vr = {};
    if (vp) { const v = this.parse(s.vForm.valor); const dif = v ? (v - vp.valor) / vp.valor : 0; vr = { sub: vp.forn + ', ' + vp.desc.toLowerCase() + '. Vence em ' + this.dd(vp.d) + '/' + this.dd(vp.m), metodo: vp.metodo, est: this.money(vp.valor), difTxt: v ? 'Diferença de ' + (dif >= 0 ? '+' : '') + (dif * 100).toFixed(1).replace('.', ',') + '% em relação ao estimado' + (Math.abs(dif) > 0.2 ? '. Vale revisar o método de estimativa da recorrência.' : '.') : 'Informe o valor para confirmar.', difColor: Math.abs(dif) > 0.2 ? '#EDB866' : '#A6A9B1' }; }
    const confirmarValor = () => { if (!vp) return; const v = this.parse(s.vForm.valor); if (v <= 0) { this.say('Informe o valor da guia'); return; } this.updP(vp.id, { valor: v, est: false, codigo: s.vForm.codigo || '85800.00000 0 71880.000000 0 00000000000', forma: vp.forma, origem: vp.origem + '. Valor real informado em 17/09 (estimado: ' + this.money(vp.valor) + ')', docs: Object.assign({}, vp.docs, { boleto: true }) }); this.setState({ valorId: null }); this.say('Valor confirmado: ' + this.money(v) + '. A projeção de caixa foi atualizada'); };

    const ta = s.team.find((t) => t.id === s.ajusteFor);
    const regras = { 'Bônus': 'Bônus soma ao total e conta como custo da equipe (Pessoal › Bonificações).', 'Comissão': 'Comissão soma ao total e fica numa linha própria, dentro de Comercial.', 'Job extra': 'Job extra soma ao total e entra como custo direto do cliente informado na descrição.', 'Reembolso': 'Reembolso soma ao total, mas usa a categoria real do gasto e não conta como custo de equipe.', 'Adiantamento': 'Adiantamento não é custo novo: é um pagamento antecipado e abate o total do mês. Informe valor negativo.', 'Desconto': 'Desconto reduz o valor do contrato no mês. Informe valor negativo.' };
    const aj = ta ? { sub: ta.nome + ', contrato de ' + this.money0(ta.base), lista: ta.aj.map((a, i) => ({ tipo: a.tipo, desc: a.desc, val: (a.val >= 0 ? '+ ' : '− ') + this.money(Math.abs(a.val)), color: a.val >= 0 ? '#6FD3A2' : '#EDB866', remove: () => this.setState({ team: s.team.map((t) => t.id === ta.id ? Object.assign({}, t, { aj: t.aj.filter((_, j) => j !== i) }) : t) }) })), vazio: ta.aj.length === 0, regra: regras[s.aForm.tipo] } : { lista: [] };

    const tabDefs = [['contas', 'Contas a pagar', null], ['folha', 'Folha', pend.length ? pend.length + ' NFs pendentes' : null], ['rec', 'Recorrências', null], ['forn', 'Fornecedores', null]];
    const tabs = tabDefs.map(([k, label, badge]) => ({ label, on: s.tab === k, fg: s.tab === k ? '#EEEEF0' : '#A6A9B1', fw: s.tab === k ? '600' : '500', line: s.tab === k ? accent : 'transparent', hasBadge: !!badge, badge: badge || '', pick: () => this.setState({ tab: k, sel: [] }) }));

    return {
      accent, mesNome, mesLabel,
      lancarArquivo: () => { const n = this.ndInit(''); this.setState({ novaOpen: true, nd: n }); },
      importar: () => this.say('Abriria a importação de despesas por CSV'),
      abrirNova: () => this.setState({ novaOpen: true, nd: this.ndInit('') }),
      kAPagar: this.money0(aPagar.reduce((a, p) => a + p.dv.saldo, 0)), kAPagarCtx: aPagar.length + ' contas, ' + month.filter((p) => p.dv.semProg).length + ' sem programação, ' + month.filter((p) => !p.dv.paid && p.est).length + (month.filter((p) => !p.dv.paid && p.est).length === 1 ? ' estimada' : ' estimadas'),
      kPago: this.money0(monthPago), kPagoPct: (monthTotal ? Math.round(monthPago / monthTotal * 100) : 0) + '%', kPagoCtx: (monthTotal ? Math.round(monthPago / monthTotal * 100) : 0) + '% de ' + this.money0(monthTotal) + ' previstos',
      kVencido: this.money0(vencAll.reduce((a, p) => a + p.dv.saldo, 0)), kVencColor: vencAll.length ? '#F08A84' : '#EEEEF0', kVencCtx: vencAll.length ? vencAll.length + (vencAll.length === 1 ? ' conta, ' : ' contas, ') + vencAll.map((p) => p.forn).join(', ') : 'Nada vencido',
      k7: this.money0(prox7.reduce((a, p) => a + p.dv.saldo, 0)), k7Ctx: 'Saldo disponível de R$ 84.320 cobre',
      kpiAberto: () => this.setState({ tab: 'contas', view: 'aberto', chip: null }), kpiPago: () => this.setState({ tab: 'contas', view: 'pagas', chip: null }), kpiVencido: () => this.setState({ tab: 'contas', view: 'vencidas', chip: null }), kpi7: () => this.setState({ tab: 'contas', view: 'aberto', chip: null }),
      tabs, tabContas: s.tab === 'contas', tabFolha: s.tab === 'folha', tabRec: s.tab === 'rec', tabForn: s.tab === 'forn',
      views, chips, modoFatura, modoLista: !modoFatura,
      mesPrev: () => this.setState({ mes: Math.max(8, s.mes - 1), sel: [] }), mesNext: () => this.setState({ mes: Math.min(12, s.mes + 1), sel: [] }),
      agrupar: s.agrupar, onAgrupar: (e) => this.setState({ agrupar: e.target.value }),
      q: s.q, onQ: (e) => this.setState({ q: e.target.value }), filtroToast: () => this.say('Filtros: fornecedor, categoria, cliente ou projeto, conta de saída'),
      groups, rowsEmpty: list.length === 0,
      allSel: list.filter((p) => p.kind === 'conta').length > 0 && list.filter((p) => p.kind === 'conta').every((p) => s.sel.includes(p.id)), toggleAll: () => { const ids = list.filter((p) => p.kind === 'conta').map((p) => p.id); this.setState({ sel: ids.every((x) => s.sel.includes(x)) ? [] : ids }); },
      footCount: list.length + (list.length === 1 ? ' conta' : ' contas') + ' neste filtro', footTotal: this.money0(sumL((p) => p.valor)), footAberto: this.money0(sumL((p) => p.dv.overdue ? 0 : p.dv.saldo)), footPago: this.money0(sumL((p) => Math.min(p.pago, p.valor))), footVenc: this.money0(sumL((p) => p.dv.overdue ? p.dv.saldo : 0)),
      hasSel: s.sel.length > 0 && s.tab === 'contas', selTxt: s.sel.length + (s.sel.length === 1 ? ' selecionada, ' : ' selecionadas, ') + this.money0(selP.reduce((a, p) => a + p.dv.saldo, 0)),
      loteProgramar: () => this.say('Programar ' + s.sel.length + ' contas para uma data. O saldo do Inter na data é mostrado antes de confirmar'),
      lotePagar: () => { const ok = selP.filter((p) => !p.dv.paid && !p.est && !(p.needsNF && !p.docs.nf)); const bloq = selP.length - ok.length; this.setState({ parcels: s.parcels.map((p) => ok.some((o) => o.id === p.id) ? Object.assign({}, p, { pago: p.valor, pagoEm: '17/09', baixas: p.baixas.concat([{ data: '17/09', desc: 'Pagamento em lote, conta Inter', val: p.valor - p.pago, conc: false }]) }) : p), sel: [] }); this.say(ok.length + (ok.length === 1 ? ' pagamento registrado' : ' pagamentos registrados') + ' em lote, de fornecedores diferentes' + (bloq ? '. ' + bloq + (bloq === 1 ? ' ficou de fora' : ' ficaram de fora') + ' (estimada ou sem a NF exigida)' : '')); },
      loteVenc: () => this.say('Abriria a alteração de vencimento'), loteExport: () => this.say('Exportaria as selecionadas em CSV'), clearSel: () => this.setState({ sel: [] }),
      fat, fatTabs, lancarCompra: () => { const n = this.ndInit(''); n.forma = 'Cartão de crédito'; n.itens = [{ cat: 'Softwares › Criação', cli: 'Operação geral', val: '' }]; this.setState({ novaOpen: true, nd: n }); },
      importarFatura: () => this.say('Importaria o arquivo da fatura e conferiria compra por compra. As não lançadas aparecem para classificar'),
      pagarFatura: () => { this.setState({ faturaPaga: true }); this.say('Fatura paga: transferência de ' + this.money(fatTotal) + ' do Inter para o Cartão Inter. Nenhuma despesa nova foi criada'); },
      fo, solicitarNfs: () => this.say(pend.length ? 'Pedido enviado com o valor exato a faturar: ' + pend.map((t) => t.nome + ' (' + this.money(t.base + t.aj.filter((a) => a.tipo !== 'Adiantamento').reduce((x, a) => x + a.val, 0)) + ')').join(' e ') : 'Todas as NFs já foram recebidas'),
      pagarLoteFolha: () => { const ok = s.team.filter((t) => !t.pago && t.nf !== false); this.setState({ team: s.team.map((t) => ok.some((o) => o.id === t.id) ? Object.assign({}, t, { pago: true }) : t) }); this.say(ok.length + ' pagamentos registrados. ' + (pend.length ? pend.map((t) => t.nome.split(' ')[0]).join(' e ') + ' ficaram de fora por falta de NF' : 'Folha completa')); },
      rc, reajLote: () => this.say('Abriria o reajuste em lote com vigência'),
      fornTipos, fornRows, fornIncTxt: '1 fornecedor sem dados de pagamento', novoFornToast: () => this.say('Abriria o cadastro de fornecedor, com busca pelo CNPJ'),
      fichaOpen: !!fp, f, fichaW: s.wide ? '100%' : '600px', toggleWide: () => this.setState({ wide: !s.wide }), closeFicha: () => this.setState({ fichaId: null }), comprovante: () => this.say('Abriria o comprovante'),
      colabOpen: !!tc, cb, closeColab: () => this.setState({ colabId: null }), reajColab: () => this.say('Nova remuneração pede valor, vigência e motivo. Cria uma versão no histórico'),
      fornOpen: !!fdd, fn, closeForn: () => this.setState({ fornNome: null }), editarForn: () => this.say('Abriria o cadastro. Mudar dados de pagamento pede confirmação e fica na auditoria'),
      recOpen: s.recIdx !== null && !!recsData[s.recIdx], rv, closeRec: () => this.setState({ recIdx: null }), recAcao: () => this.say('Editar e reajustar pedem vigência e motivo. Pausar e encerrar pedem o motivo'),
      novaOpen: s.novaOpen, closeNova: () => this.setState({ novaOpen: false }), nd, tipos, ndItens, ndTotalTxt: this.money(ndTotal), ndCartao, ndNaoCartao: !ndCartao, isRecForm: ndTipo === 'recorrente' && !ndCartao, isParcForm: ndTipo === 'parcelada' && !ndCartao,
      ndComp: this.compOf(this.pd(nd.venc)), ndCodLabel: nd.forma === 'PIX' ? 'Chave PIX' : nd.forma === 'Boleto' ? 'Linha digitável' : 'Dados para pagamento', ndCodPh: nd.forma === 'PIX' ? 'Herdada do fornecedor' : 'Cole ou leia do documento',
      onNdForn: (e) => { const v = e.target.value; if (v === '__novo') { this.say('Abriria o cadastro rápido: CNPJ com preenchimento automático, tipo e chave PIX'); return; } const d = fornDef[v]; const nd2 = { forn: v }; if (d) { nd2.itens = [{ cat: d[0], cli: nd.itens[0].cli, val: nd.itens[0].val }]; nd2.forma = d[1]; nd2.codigo = d[1] === 'PIX' ? (v.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 12) + '@pix.com.br') : nd.codigo; } this.setNd(nd2); },
      onNdDesc: (e) => this.setNd({ desc: e.target.value }), dividir: () => { const v = ndTotal || 1800; this.setNd({ itens: [{ cat: cat0, cli: 'Restaurante Sabor do Mar', val: (v / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }, { cat: cat0, cli: 'Grupo Orla, Vídeo institucional', val: (v / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }] }); this.say('Valor dividido igualmente entre 2 clientes. Ajuste os valores ou use %'); },
      addItem: () => this.setNd({ itens: nd.itens.concat([{ cat: cat0, cli: '', val: '' }]) }),
      onNdForma: (e) => this.setNd({ forma: e.target.value }), onNdVenc: (e) => this.setNd({ venc: e.target.value }), onNdProg: (e) => this.setNd({ prog: e.target.value }), onNdCodigo: (e) => this.setNd({ codigo: e.target.value }), onNdCompra: (e) => this.setNd({ compra: e.target.value }), onNdParcCartao: (e) => this.setNd({ parcCartao: e.target.value }), onNdValorTipo: (e) => this.setNd({ valorTipo: e.target.value }), onNdNParc: (e) => this.setNd({ nParc: e.target.value }),
      lerDocumento: () => { this.setNd({ lido: true, forn: 'LocaCine Equipamentos', desc: 'Locação de drone e estabilizador', itens: [{ cat: 'Custos diretos › Locação de equipamento', cli: '', val: '1.450,00' }], forma: 'Boleto', venc: '2026-10-02', codigo: '34191.79001 01043.510047 91020.150008 8 9880000145000', boleto: true, tipo: 'unica' }); this.say('Boleto lido: fornecedor, valor, vencimento e código preenchidos. Falta o cliente ou projeto'); },
      toggleNdBoleto: () => this.setNd({ boleto: !nd.boleto }), toggleNdNf: () => this.setNd({ nf: !nd.nf }),
      ndBoletoTxt: nd.boleto ? 'Boleto anexado' : 'Anexar boleto', ndBoletoStyle: nd.boleto ? 'solid' : 'dashed', ndBoletoRing: nd.boleto ? '#6FD3A2' : '#454852', ndBoletoFill: nd.boleto ? '#6FD3A2' : 'transparent',
      ndNfTxt: nd.nf ? 'NF anexada' : ((CATS[cat0] || {}).exigeNf ? 'Anexar NF (exigida para pagar)' : 'Anexar NF'), ndNfStyle: nd.nf ? 'solid' : 'dashed', ndNfBorder: !nd.nf && (CATS[cat0] || {}).exigeNf ? '#EDB866' : '#454852', ndNfRing: nd.nf ? '#6FD3A2' : '#454852', ndNfFill: nd.nf ? '#6FD3A2' : 'transparent',
      toggleMais: () => this.setNd({ mais: !nd.mais }), maisChev: nd.mais ? 'rotate(90deg)' : 'none', toggleReemb: () => this.setNd({ reemb: !nd.reemb }), reembTrack: nd.reemb ? accent : '#454852', reembKnob: nd.reemb ? '18px' : '2px',
      pv, salvarBg: pvErros.length ? '#5A5480' : accent, salvar: () => doSave('salvar'), salvarPaga: () => doSave('paga'), salvarOutra: () => doSave('outra'),
      pagarOpen: !!pp, pg, pgOpts, pForm: s.pForm, closePagar: () => this.setState({ pagarId: null }), confirmarPag,
      onPData: (e) => this.setP({ data: e.target.value }), onPValor: (e) => this.setP({ valor: e.target.value }), onPConta: (e) => this.setP({ conta: e.target.value }), onPJust: (e) => this.setP({ just: e.target.value }),
      toggleComp: () => this.setP({ comp: !s.pForm.comp }), anexarNfPg: () => { if (pp) { this.updP(pp.id, (p) => ({ docs: Object.assign({}, p.docs, { nf: true }) })); this.say('NF anexada'); } },
      valorOpen: !!vp, vr, vForm: s.vForm, closeValor: () => this.setState({ valorId: null }), confirmarValor,
      onVValor: (e) => this.setState({ vForm: Object.assign({}, s.vForm, { valor: e.target.value }) }), onVCodigo: (e) => this.setState({ vForm: Object.assign({}, s.vForm, { codigo: e.target.value }) }),
      anexarGuia: () => { this.setState({ vForm: { valor: vp && vp.cat.includes('DAS') ? '7.188,40' : '1.210,00', codigo: '85800.00000 0 71884.032875 0 00000000000' } }); this.say('Guia lida: valor e código preenchidos'); },
      ajusteOpen: !!ta, aj, aForm: s.aForm, closeAjuste: () => this.setState({ ajusteFor: null }),
      onATipo: (e) => this.setState({ aForm: Object.assign({}, s.aForm, { tipo: e.target.value }) }), onADesc: (e) => this.setState({ aForm: Object.assign({}, s.aForm, { desc: e.target.value }) }), onAValor: (e) => this.setState({ aForm: Object.assign({}, s.aForm, { valor: e.target.value }) }),
      addAjuste: () => { if (!ta) return; let v = this.parse(s.aForm.valor); if (!v) { this.say('Informe o valor do ajuste'); return; } if ((s.aForm.tipo === 'Adiantamento' || s.aForm.tipo === 'Desconto') && v > 0) v = -v; this.setState({ team: s.team.map((t) => t.id === ta.id ? Object.assign({}, t, { aj: t.aj.concat([{ tipo: s.aForm.tipo, desc: s.aForm.desc || s.aForm.tipo, val: v }]) }) : t), aForm: { tipo: 'Bônus', desc: '', valor: '' } }); this.say('Ajuste adicionado. Total de ' + ta.nome + ' atualizado'); },
      hasToast: !!s.toast, toast: s.toast || ''
    };
  }
}
