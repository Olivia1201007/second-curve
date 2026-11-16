import { describe, expect, it } from 'vitest';
import { analyzeProfile, createTasks, decomposeExperience, directions } from '../lib/engine';
import { localDemoProvider } from '../lib/career-service';

describe('career experience engine', () => {
  it('only extracts skills supported by the user description', () => {
    const input = {
      role: '采购专员',
      years: '12年',
      tasks: '负责供应商沟通和采购流程跟进；整理月度采购报表',
      strengths: '',
      weaknesses: '',
      reason: '',
    };
    const skills = analyzeProfile(input);
    expect(skills.map((skill) => skill.name)).toContain('沟通协作');
    expect(skills.every((skill) => skill.evidence.includes('你的描述'))).toBe(true);
    expect(skills.some((skill) => skill.evidence.includes('月度采购报表'))).toBe(true);
  });

  it('decomposes experience into traceable task slices', () => {
    const slices = decomposeExperience('联系供应商确认交期；跟进异常订单并与仓库沟通');
    expect(slices.length).toBeGreaterThanOrEqual(2);
    expect(slices[0].text).toContain('供应商');
    expect(slices.every((slice) => slice.aiSupport && slice.humanWork && slice.nextStep)).toBe(
      true,
    );
  });

  it('offers three distinct, evidence-aware career directions', () => {
    expect(directions).toHaveLength(3);
    expect(new Set(directions.map((direction) => direction.key)).size).toBe(3);
    expect(directions.every((direction) => direction.reuse.length && direction.gaps.length)).toBe(
      true,
    );
  });

  it('creates an editable weekly plan for a selected career goal', () => {
    const tasks = createTasks('项目协调员');
    expect(tasks).toHaveLength(4);
    expect(tasks.every((task) => task.done === false && task.output.length > 0)).toBe(true);
  });

  it('matches only text the user provided and states the limitation', async () => {
    const result = await localDemoProvider.matchJob(
      '供应商沟通、采购流程跟进',
      '岗位职责：供应商沟通；任职要求：数据分析、项目管理',
    );
    expect(result.evidence).toContain('沟通');
    expect(result.gaps).toContain('数据');
    expect(result.note).toContain('不');
  });
});
