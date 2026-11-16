import { analyzeProfile, decomposeExperience, directions, Skill } from './engine';

export type CareerRecord = {
  id: string;
  createdAt: string;
  role: string;
  taskCount: number;
  skillNames: string[];
};
export type JobMatch = { requirements: string[]; evidence: string[]; gaps: string[]; note: string };

// Provider contract: replace the local provider with a server-only model adapter when API credentials are configured.
export interface CareerProvider {
  analyze(profile: {
    role: string;
    years: string;
    tasks: string;
    strengths: string;
    weaknesses: string;
    reason: string;
  }): Promise<{ tasks: ReturnType<typeof decomposeExperience>; skills: Skill[] }>;
  matchJob(profileText: string, jobText: string): Promise<JobMatch>;
  polishExperience(text: string): Promise<string[]>;
}

const requirementTerms = [
  '沟通',
  '协调',
  '供应商',
  '客户',
  '流程',
  '审批',
  '排期',
  '数据',
  '表格',
  '报表',
  '销售',
  '跟进',
  '管理',
  '培训',
  '带教',
  '项目',
  '复盘',
  '服务',
  '质量',
  '文档',
  '分析',
  '运营',
  '库存',
  '生产',
  '安全',
  '设备',
  '采购',
  '订单',
  '投诉',
  '咨询',
];

export const localDemoProvider: CareerProvider = {
  async analyze(profile) {
    return { tasks: decomposeExperience(profile.tasks), skills: analyzeProfile(profile) };
  },
  async matchJob(profileText, jobText) {
    const requirements = requirementTerms.filter((term) => jobText.includes(term));
    const evidence = requirements.filter((term) => profileText.includes(term));
    const gaps = requirements.filter((term) => !profileText.includes(term));
    return {
      requirements,
      evidence,
      gaps,
      note: requirements.length
        ? '逐项比对招聘文本中的常见词语，仅供人工核对，不是录用概率或正式评分。'
        : '暂时没有识别出常见要求词。请人工检查招聘信息，或粘贴更完整的岗位职责与任职要求。',
    };
  },
  async polishExperience(text) {
    return text
      .split(/[；;。\n]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((line) => {
        const cleaned = line
          .replace(/^(以前|曾经|我)?(负责|主要负责|做过|工作内容是)[：:，,]?\s*/, '')
          .replace(/[。；;]+$/, '')
          .trim();
        if (!cleaned) return '';
        const alreadyHasRole = /^(参与|协助|支持|配合|负责)/.test(cleaned);
        return alreadyHasRole ? cleaned : `负责：${cleaned}`;
      })
      .filter(Boolean);
  },
};

export const careerService = localDemoProvider;
export const roleDirections = directions;
