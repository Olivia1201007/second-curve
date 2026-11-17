import { describe, expect, it, vi } from 'vitest';
import { createModelCareerProvider, redactModelText } from '../lib/model-career-provider';
import type { ModelMessage, ModelReply } from '../lib/native-model';

const profile = {
  role: '生产主管',
  years: '12年',
  tasks: '负责生产排期和班组协调',
  strengths: '熟悉Excel',
  weaknesses: '',
  reason: '',
};
const output = {
  tasks: [
    {
      id: 't1',
      text: '负责生产排期',
      skills: ['生产排期'],
      aiSupport: '辅助整理计划',
      humanWork: '确认现场约束',
      nextStep: '整理一次真实排期',
      confidence: '有线索',
    },
  ],
  skills: [
    { name: '生产协调', type: '专业技能', level: 2, evidence: '班组协调', roles: ['生产协调员'] },
  ],
};

function transport(value: unknown) {
  return vi.fn(async (messages: ModelMessage[]): Promise<ModelReply> => {
    expect(messages).toHaveLength(2);
    return { content: JSON.stringify(value), provider: 'kanshan', model: 'configured-model' };
  });
}

describe('installed model career provider', () => {
  it('keeps app contracts and sends untrusted text as user data', async () => {
    const send = transport(output);
    const result = await createModelCareerProvider(send).analyze(profile);
    expect(result).toEqual(output);
    const messages = send.mock.calls[0][0];
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(messages[0].content).toContain('不编造');
    expect(messages[1].content).toContain(profile.tasks);
  });

  it('rejects invented evidence, duplicate tasks and wrong confidence', async () => {
    for (const mutate of [
      (value: typeof output) => {
        value.skills[0].evidence = '管理80人，节省30%';
      },
      (value: typeof output) => {
        value.tasks.push(value.tasks[0]);
      },
      (value: typeof output) => {
        value.tasks[0].confidence = '肯定能就业';
      },
      (value: typeof output) => {
        value.skills[0].level = 6;
      },
    ]) {
      const value = structuredClone(output);
      mutate(value);
      await expect(createModelCareerProvider(transport(value)).analyze(profile)).rejects.toThrow(
        '无法核对',
      );
    }
  });

  it('does not silently substitute local analysis on a cloud error', async () => {
    const provider = createModelCareerProvider(async () => {
      throw new Error('模型连接超时');
    });
    await expect(provider.analyze(profile)).rejects.toThrow('模型连接超时');
  });

  it('sends only redacted identifiers and validates polished claims', async () => {
    const send = transport(['负责生产排期']);
    await createModelCareerProvider(send).polishExperience(
      '负责生产排期，电话13812345678，邮箱ab@example.com，身份证110101198001011234',
    );
    const payload = send.mock.calls[0][0][1].content;
    expect(payload).not.toContain('13812345678');
    expect(payload).not.toContain('ab@example.com');
    expect(payload).not.toContain('110101198001011234');
    expect(payload).toContain('已隐藏');
    await expect(
      createModelCareerProvider(transport(['使产能提升50%'])).polishExperience('负责生产排期'),
    ).rejects.toThrow('无法核对');
  });

  it('matches only exact supplied profile and job fragments', async () => {
    const valid = {
      requirements: ['Excel'],
      evidence: ['熟悉Excel'],
      gaps: ['管理规模需确认'],
      note: '按所给文字对照，不能保证录用',
    };
    const provider = createModelCareerProvider(transport(valid));
    expect(await provider.matchJob('熟悉Excel，做过排期', '需要Excel和协调能力')).toEqual(valid);
    await expect(
      createModelCareerProvider(transport({ ...valid, evidence: ['管理20人'] })).matchJob(
        '熟悉Excel',
        '需要Excel',
      ),
    ).rejects.toThrow('无法核对');
  });

  it('rejects incomplete JSON and invalid input before paid transport', async () => {
    const send = transport(output);
    await expect(
      createModelCareerProvider(send).analyze({ ...profile, tasks: '', strengths: '' }),
    ).rejects.toThrow('具体任务');
    expect(send).not.toHaveBeenCalled();
    await expect(
      createModelCareerProvider(transport({ reply: 'wrong shape' })).analyze(profile),
    ).rejects.toThrow('无法核对');
  });

  it('preserves ordinary dates and facts while hiding identifiers', () => {
    expect(redactModelText('2026年完成排期，电话13812345678')).toBe(
      '2026年完成排期，电话[手机号已隐藏]',
    );
  });
});
