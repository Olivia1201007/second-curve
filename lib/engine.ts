export type Skill = {
  name: string;
  type: string;
  level: number;
  evidence: string;
  roles: string[];
};
export type Task = {
  id: string;
  week: number;
  title: string;
  detail: string;
  hours: number;
  resource: string;
  output: string;
  done: boolean;
};
export type ExperienceSlice = {
  id: string;
  text: string;
  skills: string[];
  aiSupport: string;
  humanWork: string;
  nextStep: string;
  confidence: '有线索' | '待补充';
};

export const demoSkills: Skill[] = [
  {
    name: '流程协调',
    type: '专业技能',
    level: 4,
    evidence: '演示档案：协调跨部门会议、跟进审批与日程安排',
    roles: ['运营专员', '项目协调员'],
  },
  {
    name: '文档与信息管理',
    type: '数字技能',
    level: 4,
    evidence: '演示档案：维护制度文件、整理报表与知识资料',
    roles: ['运营专员', '项目协调员'],
  },
  {
    name: '沟通协作',
    type: '沟通协作',
    level: 4,
    evidence: '演示档案：作为业务团队、供应商与管理层的信息接口',
    roles: ['客户成功专员', '项目协调员'],
  },
  {
    name: '细节与质量把控',
    type: '通用能力',
    level: 4,
    evidence: '演示档案：检查合同、报销和流程材料的准确性',
    roles: ['运营专员', '客户成功专员'],
  },
  {
    name: '时间与优先级管理',
    type: '可迁移能力',
    level: 3,
    evidence: '演示档案：同时处理多项请求并按截止时间推进',
    roles: ['项目协调员', '客户成功专员'],
  },
  {
    name: '表格分析',
    type: '数字技能',
    level: 2,
    evidence: '演示档案：使用电子表格维护月度统计',
    roles: ['运营专员'],
  },
];
export const directions = [
  {
    key: '邻近转型',
    name: '运营专员',
    tag: 'A · 相邻岗位',
    fit: '流程跟进、资料管理和跨团队协调，是运营工作中可以继续使用的经验。',
    reuse: ['流程协调', '文档与信息管理', '沟通协作'],
    gaps: ['运营指标设计', '数据整理与表达', '流程优化'],
    difficulty: '较低',
    challenge: '工作内容会从按流程完成，逐渐增加主动发现问题和复盘效果。',
    learn: '运营基础、表格进阶、流程梳理。',
  },
  {
    key: '能力升级',
    name: '项目协调员',
    tag: 'B · 能力升级',
    fit: '会议组织、进度跟进和多方沟通，可以迁移到项目协作场景。',
    reuse: ['流程协调', '沟通协作', '时间与优先级管理'],
    gaps: ['项目拆解', '风险记录', '项目复盘'],
    difficulty: '中等',
    challenge: '需要及时暴露进度风险，并让相关人员对下一步达成一致。',
    learn: '项目拆解、风险清单、协作复盘。',
  },
  {
    key: '跨界探索',
    name: '客户成功专员',
    tag: 'C · 跨行业探索',
    fit: '沟通、问题跟进和资料整理经验，可以用于客户引导与服务协作。',
    reuse: ['沟通协作', '细节与质量把控', '文档与信息管理'],
    gaps: ['需求澄清', '产品演示', '客户问题跟踪'],
    difficulty: '中等',
    challenge: '需要熟悉具体产品，并练习从客户角度理解问题。',
    learn: '需求访谈、产品讲解、客户问题记录。',
  },
];

const skillRules: { name: string; type: string; pattern: RegExp; roles: string[] }[] = [
  {
    name: '流程协调',
    type: '专业技能',
    pattern: /流程|审批|协调|排期|日程|跟进|推进/,
    roles: ['运营专员', '项目协调员'],
  },
  {
    name: '文档与信息管理',
    type: '数字技能',
    pattern: /文档|资料|档案|合同|制度|记录|整理|归档/,
    roles: ['运营专员', '项目协调员'],
  },
  {
    name: '沟通协作',
    type: '沟通协作',
    pattern: /沟通|跨部门|客户|供应商|对接|会议|协作|团队/,
    roles: ['客户成功专员', '项目协调员'],
  },
  {
    name: '表格与数据整理',
    type: '数字技能',
    pattern: /表格|数据|报表|统计|excel|数字/,
    roles: ['运营专员'],
  },
  {
    name: '客户问题处理',
    type: '沟通协作',
    pattern: /客户|投诉|咨询|售后|答疑|问题处理/,
    roles: ['客户成功专员', '运营专员'],
  },
  {
    name: '业务跟进',
    type: '专业技能',
    pattern: /销售|线索|订单|商机|回访/,
    roles: ['运营专员', '客户成功专员'],
  },
  {
    name: '活动执行',
    type: '专业技能',
    pattern: /活动|内容|社群|宣传|报名|转化/,
    roles: ['运营专员'],
  },
  {
    name: '细节与质量把控',
    type: '通用能力',
    pattern: /检查|校对|审核|准确|质量|核对/,
    roles: ['运营专员', '客户成功专员'],
  },
  {
    name: '时间与优先级管理',
    type: '可迁移能力',
    pattern: /同时|优先级|截止|紧急|多项|时间安排/,
    roles: ['项目协调员', '运营专员'],
  },
  {
    name: '问题解决',
    type: '通用能力',
    pattern: /解决|排查|改进|异常|应对|处理/,
    roles: ['运营专员', '客户成功专员'],
  },
  {
    name: '团队支持与带教',
    type: '管理能力',
    pattern: /带教|排班|管理团队|绩效|培训|指导同事/,
    roles: ['项目协调员', '运营专员'],
  },
];
export function analyzeProfile(data: {
  role: string;
  years: string;
  tasks: string;
  strengths: string;
  weaknesses: string;
  reason: string;
}): Skill[] {
  const source = `${data.tasks}\n${data.strengths}`;
  return skillRules
    .filter((r) => r.pattern.test(source))
    .map((r) => {
      const evidence =
        source
          .split(/[，。；;\n]/)
          .map((s) => s.trim())
          .find((s) => s && r.pattern.test(s)) || source.trim();
      return {
        name: r.name,
        type: r.type,
        level: 2,
        evidence: `来自你的描述：「${evidence}」`,
        roles: r.roles,
      };
    });
}
export function decomposeExperience(raw: string): ExperienceSlice[] {
  const phrases = raw
    .split(/[；;。\n]+|(?<=，)/)
    .map((s) => s.replace(/^[\s，,]+|[\s，,]+$/g, '').trim())
    .filter((s) => s.length >= 4);
  return phrases.slice(0, 12).map((text, i) => {
    const matched = skillRules.filter((r) => r.pattern.test(text));
    const routine = /录入|整理|汇总|排期|提醒|归档|重复|报表|模板|查询/.test(text);
    const human = /协调|沟通|客户|判断|异常|投诉|谈判|决策|推进|处理/.test(text);
    return {
      id: `slice-${i}`,
      text,
      skills: matched.map((x) => x.name),
      aiSupport: routine
        ? 'AI 可协助起草、分类、汇总或提醒；结果需要你核对。'
        : 'AI 可协助整理信息或准备初稿；具体适用方式需要结合实际流程判断。',
      humanWork: human
        ? '仍需要人来理解背景、处理例外、沟通协商并承担判断。'
        : '核实上下文、检查结果，并决定是否适合交由工具协助。',
      nextStep: matched.length
        ? `挑一个真实例子，补充你采取的步骤和结果，验证「${matched[0].name}」这项能力。`
        : '补充一次你如何完成这件事的例子，再判断其中用到了哪些能力。',
      confidence: matched.length ? '有线索' : '待补充',
    };
  });
}
export function createTasks(role: string): Task[] {
  const plans: Record<string, [string, string, number, string, string][]> = {
    运营专员: [
      [
        '选一个你熟悉的工作流程，写下起点、经手人和完成条件。',
        '先画出现状，不急着给自己找标准答案。',
        1,
        'diagrams.net · app.diagrams.net',
        '一页流程图和 2 个待确认问题。',
      ],
      [
        '使用模拟数据练习电子表格的筛选、分类汇总和图表。',
        '从看懂数据开始，不需要一次学会所有功能。',
        2,
        'Microsoft Excel 学习中心 · support.microsoft.com/excel',
        '一张图表和 3 句观察。',
      ],
      [
        '为熟悉的流程提出一个小改进，并请一位可信任的人读一读。',
        '写清楚改进前后会有什么不同。',
        2,
        'Google Sheets · support.google.com/docs',
        '一份小改进方案和反馈记录。',
      ],
      [
        '整理前面的练习，写一段「问题—做法—结果—复盘」。',
        '可以使用模拟数据；不要放入原单位或客户的敏感资料。',
        2,
        '可用任意文档工具',
        '一份可分享的脱敏作品说明。',
      ],
    ],
    项目协调员: [
      [
        '挑一个你参与过的项目或活动，列出目标、参与者和节点。',
        '使用公开或虚构信息即可。',
        1,
        'Notion 项目模板 · notion.so/templates',
        '一页项目简述和里程碑清单。',
      ],
      [
        '练习将一个目标拆成任务、负责人、截止时间和依赖项。',
        '先从小任务练习，不要求使用专业术语。',
        2,
        'Trello 入门指南 · trello.com/guide',
        '一张清晰的任务看板。',
      ],
      [
        '为练习项目列出 3 个可能的延误因素和应对方式。',
        '关注可观察信号与谁需要被告知。',
        2,
        'Project Management Institute · pmi.org',
        '一份风险与沟通清单。',
      ],
      [
        '写一页项目复盘，说明目标、进展、调整和学到的事。',
        '突出你做了什么，不夸大团队成果。',
        2,
        '可用任意文档工具',
        '一份脱敏项目复盘。',
      ],
    ],
    客户成功专员: [
      [
        '回想一次帮助他人解决问题的经历，写下对方的目标和困难。',
        '没有客户经历时，可用同事协作场景练习。',
        1,
        '自拟练习，无需购买课程',
        '一页需求与问题记录。',
      ],
      [
        '练习把一个复杂流程讲成 3 个清晰步骤。',
        '可以请朋友听听哪里还不清楚。',
        2,
        '手机录音或文档即可',
        '一段 2 分钟讲解稿或录音。',
      ],
      [
        '制作一份常见问题与处理边界清单。',
        '标明哪些情况需要升级给负责人。',
        2,
        '可用任意文档工具',
        '一份 FAQ 与升级路径。',
      ],
      [
        '整理一个问题处理案例，说明倾听、确认、行动与跟进。',
        '请移除个人、客户与单位信息。',
        2,
        '可用任意文档工具',
        '一份脱敏案例说明。',
      ],
    ],
  };
  const items = plans[role] || [
    [
      '找一条真实招聘信息，圈出岗位职责和任职要求。',
      '不确定的内容先标出来，留待求职沟通时确认。',
      1,
      '招聘平台上的真实岗位信息',
      '一份岗位要求清单。',
    ],
    [
      '把过去的工作任务与岗位要求逐条对照。',
      '只写你确实做过的事情，不必勉强对上所有要求。',
      1,
      '使用纸笔或文档即可',
      '一张经历对照表。',
    ],
    [
      '准备一段与目标岗位有关的真实工作案例。',
      '说明当时情况、你做的事和实际结果。',
      1,
      '自拟练习，无需购买课程',
      '一段面试案例草稿。',
    ],
    [
      '根据反馈修改简历，并选择一个合适的岗位投递。',
      '确认公司和岗位信息真实，留存沟通记录。',
      1,
      '用户选择的招聘平台',
      '一份更新后的简历和求职记录。',
    ],
  ];
  return items.map((x, i) => ({
    id: `${role}-${i + 1}`,
    week: i + 1,
    title: x[0],
    detail: x[1],
    hours: x[2],
    resource: x[3],
    output: x[4],
    done: false,
  }));
}
