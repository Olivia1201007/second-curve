'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Share as ShareIcon,
  BriefcaseBusiness,
  Check,
  Clipboard,
  Copy,
  Download,
  FileText,
  Flag,
  Heart,
  History,
  Layers3,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { createTasks, demoSkills, directions, Skill, Task } from '../lib/engine';
import { careerService, JobMatch } from '../lib/career-service';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Share } from '@capacitor/share';

type Profile = {
  status: string;
  role: string;
  years: string;
  city: string;
  desiredWork: string;
  urgentIncome: string;
  weeklyHours: string;
  crossIndustry: string;
  tasks: string;
  strengths: string;
  weaknesses: string;
  reason: string;
  resumeText: string;
};
type RecordItem = {
  id: string;
  createdAt: string;
  title: string;
  summary: string;
  skills: string[];
};
type Application = {
  id: string;
  title: string;
  company: string;
  url: string;
  status: string;
  date: string;
  note: string;
};
type ToolTab = 'resume' | 'interview' | 'weekly' | 'portfolio';
type OcrWorker = import('tesseract.js').Worker;
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
const emptyProfile: Profile = {
  status: '',
  role: '',
  years: '',
  city: '',
  desiredWork: '',
  urgentIncome: '',
  weeklyHours: '',
  crossIndustry: '',
  tasks: '',
  strengths: '',
  weaknesses: '',
  reason: '',
  resumeText: '',
};
const oldDemoTasks =
  '协调跨部门会议和日程，维护制度与合同资料，整理月度费用报表，跟进采购申请与审批流程。';
const demoProfile: Profile = {
  status: '正在求职或待业中',
  role: '行政专员',
  years: '12年',
  city: '杭州',
  desiredWork: '运营专员',
  urgentIncome: '希望尽快有收入',
  weeklyHours: '每周5小时',
  crossIndustry: '愿意了解相邻行业',
  tasks: oldDemoTasks,
  strengths: '擅长把复杂事项整理清楚，跟进到完成；团队沟通比较顺畅。',
  weaknesses: '数据分析经验较少。',
  reason: '希望尽快找到能延续经验的工作。',
  resumeText: '',
};
const comfort = [
  '重新开始不需要一下子想清楚所有事情。',
  '你的经历值得被清楚、专业地表达出来。',
  '你可能比自己想象中拥有更多可以带走的能力。',
  '没关系，我们先排除不适合的选择。',
  '一次没有得到回应，不代表你的能力没有价值。',
  '这一步已经完成，值得为自己肯定一下。',
  '求职是一段过程，不是对你个人价值的判决。',
];
const demoTasks = () => createTasks('运营专员');
export default function Home() {
  const [page, setPage] = useState('home'),
    [profile, setProfile] = useState<Profile>(emptyProfile),
    [skills, setSkills] = useState<Skill[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [selected, setSelected] = useState(''),
    [step, setStep] = useState(0),
    [toolTab, setToolTab] = useState<ToolTab>('resume'),
    [toast, setToast] = useState(''),
    [ready, setReady] = useState(false),
    [demo, setDemo] = useState(false),
    [fontScale, setFontScale] = useState(0),
    [records, setRecords] = useState<RecordItem[]>([]),
    [resumeText, setResumeText] = useState(''),
    [importing, setImporting] = useState(false),
    [generated, setGenerated] = useState(''),
    [jobText, setJobText] = useState(''),
    [match, setMatch] = useState<JobMatch | null>(null),
    [interviewAnswer, setInterviewAnswer] = useState(''),
    [interviewFeedback, setInterviewFeedback] = useState(''),
    [newTask, setNewTask] = useState(''),
    [paused, setPaused] = useState(false),
    [experienceDraft, setExperienceDraft] = useState(''),
    [applications, setApplications] = useState<Application[]>([]),
    [appTitle, setAppTitle] = useState(''),
    [appCompany, setAppCompany] = useState(''),
    [appUrl, setAppUrl] = useState(''),
    [isOnline, setIsOnline] = useState(true);
  const goal = selected || profile.desiredWork || '';
  const notify = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(''), 3000);
  };
  const updateProfile = (k: keyof Profile, v: string) => setProfile((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    try {
      const p = localStorage.getItem('sc-profile-v2') || localStorage.getItem('sc-profile');
      const s = localStorage.getItem('sc-skills');
      const r = localStorage.getItem('sc-history-v2');
      const oldDemo = p ? JSON.parse(p).tasks === oldDemoTasks : false;
      if (p) {
        const saved = { ...emptyProfile, ...JSON.parse(p) };
        setProfile(saved);
        setResumeText(saved.resumeText || '');
        const flag = localStorage.getItem('sc-demo');
        setDemo(flag === 'true' || (flag !== 'false' && oldDemo));
      }
      if (s) setSkills(JSON.parse(s));
      const savedTarget =
        localStorage.getItem('sc-target-v2') || localStorage.getItem('sc-role') || '';
      setSelected(savedTarget);
      const t = localStorage.getItem(`sc-task-${savedTarget}`) || localStorage.getItem('sc-tasks');
      if (t) setTasks(JSON.parse(t));
      if (r) setRecords(JSON.parse(r));
      else {
        const old = localStorage.getItem('sc-profile');
        if (old) {
          const oldP = JSON.parse(old);
          setRecords([
            {
              id: 'legacy-1',
              createdAt: new Date().toISOString(),
              title: '上次经历整理',
              summary: `${oldP.role || '职业经历'} · 可继续修改`,
              skills: JSON.parse(s || '[]').map((x: Skill) => x.name),
            },
          ]);
        }
      }
      setApplications(JSON.parse(localStorage.getItem('sc-applications') || '[]'));
      setGenerated(localStorage.getItem('sc-generated') || '');
      setJobText(localStorage.getItem('sc-job-text') || '');
      setPaused(localStorage.getItem('sc-plan-paused') === 'true');
      setFontScale(Number(localStorage.getItem('sc-font-scale') || 0));
    } catch {
      notify('部分旧数据无法读取，可在设置中重置体验数据');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('sc-profile-v2', JSON.stringify(profile));
    localStorage.setItem('sc-skills', JSON.stringify(skills));
    localStorage.setItem('sc-tasks', JSON.stringify(tasks));
    if (goal) {
      localStorage.setItem(`sc-task-${goal}`, JSON.stringify(tasks));
      localStorage.setItem('sc-target-v2', goal);
    }
    localStorage.setItem('sc-history-v2', JSON.stringify(records));
    localStorage.setItem('sc-applications', JSON.stringify(applications));
    localStorage.setItem('sc-demo', demo ? 'true' : 'false');
    localStorage.setItem('sc-generated', generated);
    localStorage.setItem('sc-job-text', jobText);
    localStorage.setItem('sc-plan-paused', paused ? 'true' : 'false');
    localStorage.setItem('sc-font-scale', String(fontScale));
  }, [
    ready,
    profile,
    skills,
    tasks,
    goal,
    records,
    applications,
    demo,
    generated,
    jobText,
    paused,
    fontScale,
  ]);
  const go = (id: string) => {
    setPage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  useEffect(() => {
    let alive = true;
    let wasOnline = true;
    let handle: { remove: () => Promise<void> } | undefined;
    Network.getStatus()
      .then((status) => {
        if (alive) {
          wasOnline = status.connected;
          setIsOnline(status.connected);
        }
      })
      .catch(() => {
        if (alive) {
          wasOnline = navigator.onLine;
          setIsOnline(navigator.onLine);
        }
      });
    Network.addListener('networkStatusChange', (status) => {
      if (!alive) return;
      setIsOnline(status.connected);
      if (status.connected && !wasOnline)
        notify('网络已恢复。本版的分析仍在本机运行，实时 AI 与岗位检索尚未接入。');
      wasOnline = status.connected;
    })
      .then((h) => (handle = h))
      .catch(() => {});
    return () => {
      alive = false;
      void handle?.remove();
    };
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    NativeApp.addListener('backButton', () => {
      if (page !== 'home') go('home');
      else void NativeApp.exitApp();
    })
      .then((h) => (handle = h))
      .catch(() => {});
    return () => {
      void handle?.remove();
    };
  }, [page]);
  const pushRecord = (title: string, summary: string, names: string[]) => {
    const item = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      title,
      summary,
      skills: names,
    };
    setRecords((r) => [item, ...r].slice(0, 30));
  };
  const analyze = async () => {
    if (!profile.role.trim() && !profile.tasks.trim()) {
      notify('先写下一份工作或一项具体任务，就可以开始整理。');
      return;
    }
    const sourceTasks = profile.tasks || profile.resumeText || resumeText;
    const out = await careerService.analyze({
      role: profile.role,
      years: profile.years,
      tasks: [sourceTasks, profile.resumeText || resumeText].filter(Boolean).join('\n'),
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      reason: profile.reason,
    });
    setSkills(out.skills);
    setProfile((p) => ({ ...p, resumeText: p.resumeText || resumeText || '' }));
    setDemo(false);
    pushRecord(
      '经历能力整理',
      `${profile.role || '工作经历'} · 拆出 ${out.tasks.length} 项任务`,
      out.skills.map((x) => x.name),
    );
    if (!selected && profile.desiredWork) {
      setSelected(profile.desiredWork);
      setTasks(createTasks(profile.desiredWork));
    }
    go('skills');
    notify('经历已整理好。你可以逐项确认、修改或删除。');
  };
  const startProfile = () => {
    setStep(0);
    go('profile');
  };
  const loadDemo = () => {
    setProfile(demoProfile);
    setSkills(demoSkills);
    setTasks(demoTasks());
    setSelected('运营专员');
    setDemo(true);
    setRecords([
      {
        id: 'demo-record',
        createdAt: new Date().toISOString(),
        title: '演示：行政转运营',
        summary: '示例经历与能力整理',
        skills: demoSkills.map((s) => s.name),
      },
    ]);
    go('home');
    notify('已载入演示数据，可以随时重置');
  };
  const changeTarget = (r: string) => {
    if (goal) localStorage.setItem(`sc-task-${goal}`, JSON.stringify(tasks));
    const saved = localStorage.getItem(`sc-task-${r}`);
    setSelected(r);
    setTasks(saved ? JSON.parse(saved) : createTasks(r));
    setProfile((p) => ({ ...p, desiredWork: r }));
    setMatch(null);
    notify(`求职目标已更新为「${r}」`);
  };
  const toggleTask = (id: string) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    const t = tasks.find((x) => x.id === id);
    if (t && !t.done) notify('这一步已经完成，值得为自己肯定一下。');
  };
  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks((t) => [
      ...t,
      {
        id: `custom-${Date.now()}`,
        week: 1,
        title: newTask.trim(),
        detail: '按自己的节奏完成；也可以随时修改或暂停。',
        hours: 1,
        resource: '自选',
        output: '一份可保存的练习记录',
        done: false,
      },
    ]);
    setNewTask('');
    notify('已添加到行动计划');
  };
  const handleResume = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    let ocrWorker: OcrWorker | null = null;
    try {
      let text = '';
      const name = file.name.toLowerCase();
      if (name.endsWith('.txt') || name.endsWith('.md')) text = await file.text();
      else if (name.endsWith('.docx')) {
        const mammoth = await import('mammoth/mammoth.browser');
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value;
      } else if (name.endsWith('.pdf')) {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
          .promise;
        for (let n = 1; n <= Math.min(doc.numPages, 12); n++) {
          const page = await doc.getPage(n);
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
          if (pageText.trim()) text += pageText + '\n';
          else {
            if (!ocrWorker) {
              const tesseract = await import('tesseract.js');
              ocrWorker = await tesseract.createWorker('chi_sim+eng', 1, {
                workerPath: '/tesseract/worker.min.js',
                corePath: '/tesseract-core/tesseract-core.wasm.js',
                langPath: '/ocr-data',
              });
            }
            const viewport = page.getViewport({ scale: 1.4 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');
            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              const result = await ocrWorker.recognize(canvas);
              text += result.data.text + '\n';
            }
          }
        }
      } else if (file.type.startsWith('image/')) {
        const tesseract = await import('tesseract.js');
        ocrWorker = await tesseract.createWorker('chi_sim+eng', 1, {
          workerPath: '/tesseract/worker.min.js',
          corePath: '/tesseract-core/tesseract-core.wasm.js',
          langPath: '/ocr-data',
        });
        const result = await ocrWorker.recognize(file);
        text = result.data.text;
      } else throw new Error('请上传 PDF、DOCX、TXT、Markdown 或图片文件');
      if (!text.trim())
        throw new Error('没有识别到可读取文字，请试试清晰度更高的文件，或直接粘贴文字');
      setResumeText(text.slice(0, 20000));
      setProfile((p) => ({ ...p, resumeText: text.slice(0, 20000) }));
      notify('文件已在当前浏览器读取。请检查内容并删除个人联系方式。');
    } catch (e) {
      notify(e instanceof Error ? e.message : '读取失败，请直接粘贴简历文字');
    } finally {
      if (ocrWorker) await ocrWorker.terminate();
      setImporting(false);
    }
  };
  const voice = (target: 'tasks' | 'answer') => {
    const w = window as SpeechWindow;
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) {
      notify('此浏览器暂不支持语音输入，可以使用键盘或系统语音输入。');
      return;
    }
    const rec = new C();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const text = ev.results?.[0]?.[0]?.transcript || '';
      if (target === 'tasks')
        updateProfile('tasks', `${profile.tasks}${profile.tasks ? '。' : ''}${text}`);
      else setInterviewAnswer((a) => `${a}${a ? ' ' : ''}${text}`);
    };
    rec.onerror = () => notify('没有识别到语音，请再试一次或改用文字输入');
    rec.start();
    notify('正在聆听，请开始说话');
  };
  const polished = async () => {
    const text = profile.tasks || profile.resumeText;
    if (!text.trim()) {
      notify('先写下或导入一段真实工作经历。');
      return;
    }
    const bullets = await careerService.polishExperience(text);
    const output = `工作经历表达（请核对后使用）\n\n${bullets.map((x) => `• ${x}`).join('\n')}\n\n说明：以上仅调整表达顺序与用词，没有添加业绩或数字。请删除与你实际经历不符的内容。`;
    setGenerated(output);
    pushRecord(
      '简历经历表达',
      `${bullets.length} 条经历描述已整理`,
      skills.map((s) => s.name),
    );
    notify('已生成可编辑的经历表达');
  };
  const generateDoc = (kind: 'resume' | 'intro' | 'email') => {
    const role = goal || profile.desiredWork || '目标岗位';
    const exp =
      (skills.length
        ? skills.map((s) => `• ${s.evidence.replace(/^来自你的描述：/, '')}`).join('\n')
        : (profile.tasks || profile.resumeText || resumeText)
            .split(/[；;。\n]+/)
            .filter(Boolean)
            .map((x) => `• ${x.trim()}`)
            .join('\n')) || '请补充一段真实的工作经历';
    let text = '';
    if (kind === 'resume')
      text = `求职目标：${role}\n\n个人简介\n${profile.years ? `${profile.years}工作经验，` : ''}曾从事${profile.role || '相关工作'}。具备以下经本人经历支持的工作经验：\n${exp}\n\n相关技能\n${skills.map((x) => `• ${x.name}`).join('\n') || '• 请根据实际情况补充'}\n\n请补充真实的工作时间、职责范围和成果；本工具不会代填业绩数据。`;
    if (kind === 'intro')
      text = `您好，我之前主要从事${profile.role || '相关工作'}，有${profile.years || '多年'}工作经验。过去的工作中，我实际参与过：\n${exp}\n\n我希望应聘${role}，也在持续补充相关能力。希望有机会进一步介绍我的经历。`;
    if (kind === 'email')
      text = `主题：应聘${role}｜${profile.role || '相关工作'}经验\n\n您好：\n\n我想应聘贵方的${role}岗位。我过去从事${profile.role || '相关工作'}，有${profile.years || '相关'}工作经验，实际工作内容包括：\n${exp}\n\n随信附上简历，期待有机会进一步沟通。谢谢！\n\n此致\n敬礼\n[请填写姓名与联系方式]`;
    setGenerated(text);
    setToolTab('resume');
    notify('内容已生成，可继续修改、复制或导出 PDF');
  };
  const matchPosting = async () => {
    if (!jobText.trim()) {
      notify('先粘贴招聘信息中的岗位职责和要求。');
      return;
    }
    const text = [
      profile.role,
      profile.tasks,
      profile.strengths,
      skills.map((s) => s.name + ' ' + s.evidence).join(' '),
    ].join('\n');
    const result = await careerService.matchJob(text, jobText);
    setMatch(result);
    pushRecord(
      '招聘信息对照',
      `识别到 ${result.requirements.length} 个常见要求词`,
      result.evidence,
    );
  };
  const exportPdf = () => {
    if (!generated.trim()) {
      notify('先生成或填写一份求职材料。');
      return;
    }
    window.print();
  };
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('已复制到剪贴板');
    } catch {
      notify('复制失败，请选中文本后手动复制');
    }
  };
  const shareAnalysis = async () => {
    if (!generated.trim()) {
      notify('先生成一份求职材料，再进行分享。');
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'SECOND CURVE 求职准备记录',
          text: generated,
          dialogTitle: '分享求职准备记录',
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'SECOND CURVE 求职准备记录', text: generated });
        return;
      }
      await copyText(generated);
    } catch {
      notify('暂时无法打开系统分享，请使用复制按钮。');
    }
  };
  const saveAnalysis = () => {
    const output =
      generated ||
      `SECOND CURVE 求职准备记录\n\n${profile.role} · ${goal || '目标岗位'}\n\n${profile.tasks}\n\n技能线索：${skills.map((s) => s.name).join('、')}\n\n${comfort[6]}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }));
    a.download = 'SECOND-CURVE-求职准备.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    notify('已下载文本记录');
  };
  const eraseData = () => {
    if (!window.confirm('删除保存在这台浏览器里的职业档案、任务和历史记录？此操作无法撤回。'))
      return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sc-'))
      .forEach((k) => localStorage.removeItem(k));
    setProfile(emptyProfile);
    setSkills([]);
    setTasks([]);
    setSelected('');
    setRecords([]);
    setApplications([]);
    setGenerated('');
    setJobText('');
    setMatch(null);
    setDemo(false);
    setPage('home');
    notify('本机资料已删除');
  };
  const addApplication = () => {
    if (!appTitle.trim()) {
      notify('先填写岗位名称，之后可以补充公司和链接。');
      return;
    }
    setApplications((a) => [
      {
        id: String(Date.now()),
        title: appTitle.trim(),
        company: appCompany.trim(),
        url: appUrl.trim(),
        status: '待了解',
        date: new Date().toISOString().slice(0, 10),
        note: '',
      },
      ...a,
    ]);
    setAppTitle('');
    setAppCompany('');
    setAppUrl('');
    notify('已保存求职跟进记录');
  };
  const profileReady = Boolean(profile.role || profile.tasks || profile.resumeText);
  const scaleClass = fontScale > 0 ? 'font-large' : fontScale < 0 ? 'font-small' : '';
  return (
    <div className={`app-shell ${scaleClass} ${page === 'home' ? 'home-view' : ''}`}>
      <header className="site-header">
        <button className="brand" onClick={() => go('home')} aria-label="SECOND CURVE 首页">
          <span className="brand-mark">
            <svg viewBox="0 0 42 34" fill="none" aria-hidden="true">
              <path
                d="M3 28C10 28 12 7 21 7s9 20 18 20"
                stroke="currentColor"
                strokeWidth="2.7"
                strokeLinecap="round"
              />
              <path
                d="M3 19c6 0 8-10 14-10 7 0 7 17 15 17h7"
                stroke="currentColor"
                strokeWidth="2.7"
                strokeLinecap="round"
                opacity=".48"
              />
            </svg>
          </span>
          <span>
            <b>SECOND CURVE</b>
            <small>第二曲线</small>
          </span>
        </button>
        {profileReady && (
          <nav className="phase-nav refined-nav" aria-label="主导航">
            <button className={page === 'home' ? 'active' : ''} onClick={() => go('home')}>
              首页
            </button>
            <button
              className={
                page === 'profile' || page === 'skills' || page === 'toolkit' ? 'active' : ''
              }
              onClick={() => go('profile')}
            >
              我的求职
            </button>
            <button className={page === 'jobs' ? 'active' : ''} onClick={() => go('jobs')}>
              职业规划
            </button>
            <button className={page === 'history' ? 'active' : ''} onClick={() => go('history')}>
              求职进度
            </button>
          </nav>
        )}
        <div className="header-actions">
          {!isOnline && (
            <span className="network-note" role="status">
              离线 · 本机资料仍可查看
            </span>
          )}
          <button
            className="profile-entry"
            onClick={() => go(profileReady ? 'settings' : 'profile')}
            aria-label="个人中心"
          >
            个人中心
          </button>
        </div>
      </header>
      <main className="page-wrap">
        {page === 'home' && (
          <section className="welcome-home">
            <div className="welcome-content">
              <span className="home-brand-line">
                SECOND CURVE <i />
              </span>
              <h1>
                人生不止一条
                <br className="mobile-break" />
                职业曲线。
              </h1>
              <h2>过去的经验，依然可以成为未来的力量。</h2>
              <p>
                无论你正在寻找新工作、考虑职业转型，还是不知道下一步该做什么，
                <br className="desktop-break" />
                都可以从这里开始。
              </p>
              <div className="welcome-actions">
                <button className="btn primary" onClick={startProfile}>
                  开始我的求职规划
                  <ArrowRight size={17} />
                </button>
                <label className="btn secondary upload-home">
                  上传简历，帮我整理经历
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,image/*"
                    disabled={importing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        startProfile();
                        void handleResume(f);
                      }
                    }}
                    hidden
                  />
                </label>
              </div>
              <button
                className="quiet-entry"
                onClick={() => {
                  setToolTab('interview');
                  go('toolkit');
                }}
              >
                我想先聊聊自己的情况
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="home-reassurance">不必急着想清楚所有事情，我们先从一小步开始。</div>
          </section>
        )}
        {page === 'profile' && (
          <section className="stage">
            <PageHeading
              eyebrow="第一步 · 了解我的情况"
              title="先从你熟悉的工作说起"
              desc="每一步只问几件事。可以暂时跳过，填写内容会自动保存在这台设备。"
              warm={comfort[0]}
            />
            <div className="step-indicator">
              {['工作经历', '能力线索', '求职目标', '计划安排'].map((x, i) => (
                <button
                  key={x}
                  onClick={() => setStep(i)}
                  className={step === i ? 'current' : step > i ? 'passed' : ''}
                >
                  <span>{step > i ? <Check size={13} /> : i + 1}</span>
                  {x}
                </button>
              ))}
            </div>
            <div className="form-panel">
              <div className="form-title">
                <div>
                  <span className="small-cap">第 {step + 1} 步，共 4 步</span>
                  <h2>
                    {
                      [
                        '你之前做什么工作？',
                        '哪些事你做得比较顺手？',
                        '你现在想找什么工作？',
                        '你希望按什么节奏准备？',
                      ][step]
                    }
                  </h2>
                  <p>
                    {
                      [
                        '先写大概就好，行业和职位名称都可以。',
                        '想一想同事常请你帮忙做什么。',
                        '求职地点、收入时间和行业偏好都可以调整。',
                        '学习时间不需要多，安排得下就可以。',
                      ][step]
                    }
                  </p>
                </div>
                <span className="step-count">0{step + 1}</span>
              </div>
              {step === 0 && (
                <>
                  <div className="form-grid">
                    <label className="field">
                      <span>最近的工作状态</span>
                      <select
                        value={profile.status}
                        onChange={(e) => updateProfile('status', e.target.value)}
                      >
                        <option value="">请选择（可跳过）</option>
                        {[
                          '正在求职或待业中',
                          '被裁员后正在求职',
                          '刚离开上一份工作',
                          '在职，考虑变化',
                          '其他情况',
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="你之前做什么工作？"
                      value={profile.role}
                      onChange={(v) => updateProfile('role', v)}
                      placeholder="例如：行政、客服、销售、生产管理"
                    />
                    <Field
                      label="做了多少年？"
                      value={profile.years}
                      onChange={(v) => updateProfile('years', v)}
                      placeholder="例如：8 年"
                    />
                    <Field
                      label="你现在在哪个城市找工作？"
                      value={profile.city}
                      onChange={(v) => updateProfile('city', v)}
                      placeholder="例如：杭州（可选）"
                    />
                  </div>
                  <div className="file-import">
                    <div className="upload-symbol">
                      <Upload size={18} />
                    </div>
                    <div>
                      <b>{importing ? '正在本机读取简历…' : '也可以上传简历'}</b>
                      <p>
                        支持 PDF、Word（DOCX）、TXT、Markdown
                        和图片；文件在本机读取。图片在浏览器本机识别，不上传。
                      </p>
                    </div>
                    <label className="btn secondary small">
                      选择简历
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.md,image/*"
                        disabled={importing}
                        onChange={(e) => handleResume(e.target.files?.[0])}
                        hidden
                      />
                    </label>
                  </div>
                  <button className="voice-link" onClick={() => voice('tasks')}>
                    <Mic size={15} />
                    也可以用语音说说你的工作
                  </button>
                  {resumeText && (
                    <Field
                      label="简历文字预览（可修改）"
                      value={resumeText}
                      onChange={(v) => {
                        setResumeText(v);
                        updateProfile('resumeText', v);
                      }}
                      area
                    />
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <Field
                    label="你每天主要做哪些事情？"
                    hint="列几件常做的事即可，不用写得专业"
                    value={profile.tasks}
                    onChange={(v) => updateProfile('tasks', v)}
                    area
                    placeholder="例如：负责采购、联系供应商、整理资料……"
                  />
                  <button className="voice-link" onClick={() => voice('tasks')}>
                    <Mic size={15} />
                    语音输入工作内容
                  </button>
                  <Field
                    label="你最擅长什么？别人常找你帮什么忙？"
                    value={profile.strengths}
                    onChange={(v) => updateProfile('strengths', v)}
                    area
                    placeholder="例如：沟通协调、做事细致、处理突发情况……"
                  />
                  <Field
                    label="有什么事情让你觉得比较吃力？（可选）"
                    value={profile.weaknesses}
                    onChange={(v) => updateProfile('weaknesses', v)}
                    placeholder="用来调整计划，不会作为能力评价。"
                  />
                </>
              )}
              {step === 2 && (
                <>
                  <Field
                    label="希望从事什么类型的工作？"
                    value={profile.desiredWork}
                    onChange={(v) => updateProfile('desiredWork', v)}
                    placeholder="例如：继续做行政，或尝试运营"
                  />
                  <div className="form-grid">
                    <Field
                      label="求职城市"
                      value={profile.city}
                      onChange={(v) => updateProfile('city', v)}
                      placeholder="城市或地区"
                    />
                    <label className="field">
                      <span>目前是否需要尽快有收入？</span>
                      <select
                        value={profile.urgentIncome}
                        onChange={(e) => updateProfile('urgentIncome', e.target.value)}
                      >
                        <option value="">请选择（可跳过）</option>
                        {['希望尽快有收入', '可以边找工作边准备', '暂时优先考虑合适方向'].map(
                          (x) => (
                            <option key={x}>{x}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>你愿意考虑相邻行业吗？</span>
                    <select
                      value={profile.crossIndustry}
                      onChange={(e) => updateProfile('crossIndustry', e.target.value)}
                    >
                      <option value="">请选择（可跳过）</option>
                      {['希望延续原行业', '愿意了解相邻行业', '愿意探索不同领域'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="你为什么想换工作？（可选）"
                    value={profile.reason}
                    onChange={(v) => updateProfile('reason', v)}
                    placeholder="例如：行业变化、希望稳定、想延续经验"
                  />
                </>
              )}
              {step === 3 && (
                <>
                  <label className="field">
                    <span>每周大约能留多少时间准备？</span>
                    <select
                      value={profile.weeklyHours}
                      onChange={(e) => updateProfile('weeklyHours', e.target.value)}
                    >
                      <option value="">请选择（可跳过）</option>
                      {['每周1—2小时', '每周3—5小时', '每周6—10小时', '时间不固定'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <div className="gentle-box">
                    <Heart size={17} />
                    <p>计划会按你的现实情况安排。家庭、健康和休息都重要；你可以随时暂停或调整。</p>
                  </div>
                  <Field
                    label="还有什么希望我们知道的？（可选）"
                    value={profile.reason}
                    onChange={(v) => updateProfile('reason', v)}
                    area
                    placeholder="比如：希望先找离家近的工作，或先做兼职……"
                  />
                </>
              )}
              <div className="form-actions">
                <button
                  className="btn secondary"
                  onClick={() => (step === 0 ? go('home') : setStep(step - 1))}
                >
                  {step === 0 ? <ArrowLeft size={15} /> : <ArrowLeft size={15} />}返回
                </button>
                <span className="save-hint">
                  <ShieldCheck size={14} />
                  已自动保存在本机
                </span>
                {step < 3 ? (
                  <button className="btn primary" onClick={() => setStep(step + 1)}>
                    继续
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="btn primary" onClick={analyze}>
                    整理我的经历
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
            <p className="stage-note">
              不用因为年龄给自己设限。我们只看实际做过的事和想尝试的方向。
            </p>
          </section>
        )}
        {page === 'skills' && (
          <section className="stage">
            <PageHeading
              eyebrow="第二步 · 重新发现我的能力"
              title="你的经历里，藏着可以带走的能力"
              desc="每项能力都对应你写下的经历。你可以确认、修改或删除；没有证据的内容不会自动添加。"
              warm={comfort[2]}
              action={
                <button className="btn secondary" onClick={() => go('profile')}>
                  修改经历
                </button>
              }
            />
            <div className="analysis-mode">
              <Sparkles size={15} />
              {demo
                ? '演示数据：内容为示例经历。'
                : '本地演示分析：根据文字线索整理，尚未调用真实 AI。'}
              <span>不会虚构业绩或就业结果。</span>
            </div>
            <div className="skill-actions">
              <button
                className="btn primary"
                onClick={() => {
                  setExperienceDraft('');
                  notify('输入真实经历后，可整理为简历表达');
                }}
              >
                <Sparkles size={16} />
                帮我把经历写得更专业
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setSkills((s) => [
                    ...s,
                    {
                      name: '',
                      type: '可迁移能力',
                      level: 2,
                      evidence: '请补充真实经历依据',
                      roles: [],
                    },
                  ]);
                  notify('新增一项后可点击修改，补充名称和依据');
                }}
              >
                <Plus size={16} />
                补充能力
              </button>
            </div>
            <div className="skills-list">
              {skills.map((s, i) => (
                <article className="skill-row" key={`${s.name}-${i}`}>
                  <div className="skill-icon">
                    <Layers3 size={18} />
                  </div>
                  <div className="skill-body">
                    <div className="skill-title">
                      <h3>{s.name || '待填写能力名称'}</h3>
                      <span>{s.type}</span>
                    </div>
                    <p>{s.evidence}</p>
                    {s.roles.length > 0 && <small>可能用到的方向：{s.roles.join('、')}</small>}
                  </div>
                  <div className="skill-row-actions">
                    <button
                      className="icon-button"
                      onClick={() => {
                        const name = prompt('技能名称', s.name);
                        if (name === null) return;
                        const ev = prompt('这项技能对应哪段真实经历？', s.evidence);
                        if (ev === null) return;
                        setSkills((all) =>
                          all.map((x, n) => (n === i ? { ...x, name, evidence: ev } : x)),
                        );
                      }}
                      aria-label={`编辑${s.name}`}
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => setSkills((all) => all.filter((_, n) => n !== i))}
                      aria-label={`删除${s.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
              {skills.length === 0 && (
                <Empty
                  title="还没有整理出能力线索"
                  desc="返回上一阶段，写下一两件你实际做过的事。整理后会在这里看到对应的能力与依据。"
                  action={() => go('profile')}
                />
              )}
            </div>
            <div className="polish-panel">
              <div>
                <span className="small-cap">经历表达助手</span>
                <h3>把日常说法整理得更清楚</h3>
                <p>只调整表达，不添加你没做过的业绩。</p>
              </div>
              <Field
                label="粘贴一段工作经历"
                value={experienceDraft}
                onChange={setExperienceDraft}
                area
                placeholder="例如：以前负责公司采购，经常跟供应商沟通，也负责整理资料。"
              />
              <button
                className="btn secondary"
                onClick={async () => {
                  if (!experienceDraft.trim()) {
                    notify('请先写下一段实际工作经历');
                    return;
                  }
                  const out = await careerService.polishExperience(experienceDraft);
                  setGenerated(out.join('\n'));
                  setToolTab('resume');
                  go('toolkit');
                  notify('已整理措辞，请核对准确后再使用');
                }}
              >
                <Sparkles size={15} />
                整理表达
              </button>
            </div>
          </section>
        )}
        {page === 'jobs' && (
          <section className="stage">
            <PageHeading
              eyebrow="第三步 · 找到适合我的工作"
              title="先看哪些方向值得一试"
              desc="这不是录用概率预测。我们从你的真实经历出发，帮助你比较经验延续、能力升级和相邻行业方向。"
              warm={comfort[3]}
              action={
                <button className="btn primary" onClick={() => go('toolkit')}>
                  准备求职材料
                  <ArrowRight size={15} />
                </button>
              }
            />
            <div className="direction-grid">
              {directions.map((d, i) => (
                <article
                  className={`direction-card ${goal === d.name ? 'selected' : ''}`}
                  key={d.name}
                >
                  <div className="direction-top">
                    <span className="direction-letter">{String.fromCharCode(65 + i)}</span>
                    <span>{d.tag}</span>
                  </div>
                  <h2>{d.name}</h2>
                  <p>{d.fit}</p>
                  <div className="direction-evidence">
                    <b>你已经写下的相关经验</b>
                    <span>
                      {skills.filter((s) => d.reuse.includes(s.name)).length
                        ? skills
                            .filter((s) => d.reuse.includes(s.name))
                            .map((s) => s.evidence)
                            .join('；')
                        : '目前还没有直接证据。可以先做练习验证，不代表你不适合。'}
                    </span>
                  </div>
                  <div className="direction-row">
                    <b>可迁移经验</b>
                    <span>{d.reuse.join('、')}</span>
                  </div>
                  <div className="direction-row">
                    <b>常见要求与待补充能力</b>
                    <span>{d.gaps.join('、')}</span>
                  </div>
                  <div className="direction-row">
                    <b>可能的困难</b>
                    <span>{d.challenge}</span>
                  </div>
                  <div className="direction-row">
                    <b>进一步确认</b>
                    <span>查看真实招聘信息，确认工作地点、班次、收入构成与岗位要求。</span>
                  </div>
                  <button
                    className={`btn ${goal === d.name ? 'secondary' : 'primary'} full`}
                    onClick={() => changeTarget(d.name)}
                  >
                    {goal === d.name ? '当前求职目标' : '设为我的求职目标'}
                    {goal === d.name ? <Check size={15} /> : <ArrowRight size={15} />}
                  </button>
                </article>
              ))}
            </div>
            <div className="job-match panel">
              <div className="panel-heading">
                <div>
                  <span className="small-cap">招聘信息对照</span>
                  <h2>找到真实岗位后，粘贴招聘内容</h2>
                </div>
                <Search size={19} />
              </div>
              <p className="muted-text">
                我们会对照你的经历指出已提及的要求和仍需确认的部分。不搜索或编造企业、薪资和职位。
              </p>
              <textarea
                className="large-textarea"
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                placeholder="粘贴招聘平台上的岗位职责和任职要求……"
              />
              <button className="btn primary" onClick={matchPosting}>
                对照我的经历
                <ArrowRight size={16} />
              </button>
              {match && (
                <div className="match-result">
                  <div className="match-note">
                    <ShieldCheck size={16} />
                    {match.note}
                  </div>
                  <div className="match-cols">
                    <div>
                      <b>经历中提到的关键词</b>
                      <p>
                        {match.evidence.join('、') || '暂未找到直接对应词，请检查经历是否写具体'}
                      </p>
                    </div>
                    <div>
                      <b>建议核实或补充的关键词</b>
                      <p>
                        {match.gaps.join('、') ||
                          '没有识别出额外关键词。仍请人工核对完整岗位要求。'}
                      </p>
                    </div>
                  </div>
                  <p className="match-caveat">
                    词语出现不等于具备熟练经验；请以实际经历和招聘方要求为准。
                  </p>
                  <p className="match-warm">{comfort[4]}</p>
                </div>
              )}
              <div className="real-jobs">
                <b>查看真实招聘信息</b>
                <a href="https://www.zhaopin.com/" target="_blank" rel="noreferrer">
                  智联招聘 <ArrowRight size={12} />
                </a>
                <a href="https://www.51job.com/" target="_blank" rel="noreferrer">
                  前程无忧 <ArrowRight size={12} />
                </a>
                <a href="https://www.zhipin.com/" target="_blank" rel="noreferrer">
                  BOSS直聘 <ArrowRight size={12} />
                </a>
              </div>
            </div>
            <div className="panel source-panel">
              <span className="small-cap">来源与真实性</span>
              <h2>真实岗位信息，由你选择并核实</h2>
              <p>
                当前版本没有接入知乎 API
                或招聘平台数据。这里不会展示虚构岗位、薪资或热度。你可以查看官方平台，复制真实岗位内容到上方对照。
              </p>
              <div className="source-links">
                <a href="https://developer.zhihu.com/" target="_blank" rel="noreferrer">
                  知乎数据开放平台
                </a>
                <a href="https://www.zhaopin.com/" target="_blank" rel="noreferrer">
                  智联招聘
                </a>
                <a href="https://www.51job.com/" target="_blank" rel="noreferrer">
                  前程无忧
                </a>
                <a href="https://www.zhipin.com/" target="_blank" rel="noreferrer">
                  BOSS直聘
                </a>
              </div>
              <small>
                外部来源链接 · 请在平台内核对职位仍在招聘、发布时间、工作地点与收入说明。
              </small>
            </div>
            <div className="panel tracker-panel">
              <div className="panel-heading">
                <div>
                  <span className="small-cap">我的求职进展</span>
                  <h2>把看过的岗位和下一步记下来</h2>
                </div>
                <span className="source-count">{applications.length} 条记录</span>
              </div>
              <div className="tracker-form">
                <input
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  placeholder="岗位名称（必填）"
                />
                <input
                  value={appCompany}
                  onChange={(e) => setAppCompany(e.target.value)}
                  placeholder="公司名称（可选）"
                />
                <input
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  placeholder="真实岗位链接（可选）"
                />
                <button className="btn primary" onClick={addApplication}>
                  <Plus size={15} />
                  记录岗位
                </button>
              </div>
              {applications.length ? (
                applications.map((a) => (
                  <article className="application-row" key={a.id}>
                    <div>
                      <b>{a.title}</b>
                      <span>
                        {a.company || '公司待核实'} · 记录于 {a.date}
                      </span>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noreferrer">
                          打开原始岗位信息
                        </a>
                      )}
                    </div>
                    <select
                      aria-label="更新求职进度"
                      value={a.status}
                      onChange={(e) =>
                        setApplications((xs) =>
                          xs.map((x) => (x.id === a.id ? { ...x, status: e.target.value } : x)),
                        )
                      }
                    >
                      {['待了解', '准备投递', '已投递', '待面试', '已录用', '已关闭'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    <button
                      className="icon-button danger"
                      aria-label="删除岗位记录"
                      onClick={() => setApplications((xs) => xs.filter((x) => x.id !== a.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))
              ) : (
                <p className="empty-tracker">
                  还没有记录。先浏览真实招聘信息，再把想进一步了解的岗位放在这里。
                </p>
              )}
            </div>
            <div className="panel horizon-panel">
              <span className="small-cap">职业路径 · 参考框架</span>
              <h2>把方向拆成可以逐步验证的阶段</h2>
              <p>
                以下是根据当前目标生成的规划假设，不是就业承诺。每一步都可以按家庭、收入和时间情况调整。
              </p>
              <div className="horizon-grid">
                <div>
                  <b>接下来 1 年</b>
                  <strong>稳定求职方向</strong>
                  <span>核对真实岗位要求，整理可证明的经验，进行小步投递与复盘。</span>
                </div>
                <div>
                  <b>接下来 3 年</b>
                  <strong>积累岗位能力</strong>
                  <span>根据实际工作机会补齐常用工具和流程能力，形成可展示的成果。</span>
                </div>
                <div>
                  <b>接下来 5 年</b>
                  <strong>拓展经验选择</strong>
                  <span>结合健康、家庭与市场变化，评估更稳定或更适合的工作安排。</span>
                </div>
              </div>
            </div>
          </section>
        )}
        {page === 'toolkit' && (
          <section className="stage">
            <PageHeading
              eyebrow="第四步 · 帮我真正开始求职"
              title="把准备好的内容，变成可以使用的材料"
              desc="所有草稿都可以修改、复制、保存在本机或打印为 PDF。请核实每一句都符合真实经历。"
              warm={comfort[1]}
            />
            <div className="tool-tabs">
              {(
                [
                  ['resume', '简历与沟通', FileText],
                  ['interview', '面试练习', MessageCircle],
                  ['weekly', '每周计划', Flag],
                  ['portfolio', '作品练习', BriefcaseBusiness],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={toolTab === id ? 'active' : ''}
                  onClick={() => setToolTab(id)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            {toolTab === 'resume' && (
              <div className="tool-layout">
                <aside className="tool-menu panel">
                  <span className="small-cap">选择一个小工具</span>
                  <button onClick={() => polished()}>
                    <Sparkles size={16} />
                    整理工作经历表达
                  </button>
                  <button onClick={() => generateDoc('resume')}>
                    <FileText size={16} />
                    生成目标岗位简历草稿
                  </button>
                  <button onClick={() => generateDoc('intro')}>
                    <MessageCircle size={16} />
                    准备自我介绍
                  </button>
                  <button onClick={() => generateDoc('email')}>
                    <Clipboard size={16} />
                    写求职沟通文本
                  </button>
                  <div className="tool-disclaimer">
                    本地示例工具，不会自动发送材料，也不会补写业绩。
                  </div>
                </aside>
                <div className="editor panel">
                  <div className="editor-head">
                    <div>
                      <span className="small-cap">可编辑草稿</span>
                      <h2>检查准确后再使用</h2>
                    </div>
                    <span className="local-label">
                      <ShieldCheck size={14} />
                      仅保存在本机
                    </span>
                  </div>
                  <textarea
                    className="editor-area"
                    value={generated}
                    onChange={(e) => setGenerated(e.target.value)}
                    placeholder="点击左侧工具生成草稿，或者在这里直接写。所有内容都可自行修改。"
                  />
                  <div className="editor-actions">
                    <button
                      className="btn secondary"
                      onClick={() => copyText(generated)}
                      disabled={!generated}
                    >
                      <Copy size={15} />
                      复制
                    </button>
                    <button className="btn secondary" onClick={shareAnalysis} disabled={!generated}>
                      <ShareIcon size={15} />
                      分享
                    </button>
                    <button className="btn secondary" onClick={saveAnalysis} disabled={!generated}>
                      <Download size={15} />
                      下载文本
                    </button>
                    <button className="btn primary" onClick={exportPdf} disabled={!generated}>
                      <Printer size={15} />
                      打印 / 保存为 PDF
                    </button>
                  </div>
                  <p className="editor-note">
                    PDF 通过浏览器打印功能生成。打印窗口中选择“保存为 PDF”。
                  </p>
                </div>
              </div>
            )}
            {toolTab === 'interview' && (
              <div className="interview-layout">
                <div className="panel interview-question">
                  <span className="small-cap">面试练习 · 本地示例</span>
                  <h2>请介绍一次你处理复杂工作或突发情况的经历。</h2>
                  <p>可以按「当时的情况—你做了什么—结果或收获」来回答。不必追求标准答案。</p>
                  <button className="voice-link" onClick={() => voice('answer')}>
                    <Mic size={15} />
                    语音输入回答
                  </button>
                  <textarea
                    className="large-textarea"
                    value={interviewAnswer}
                    onChange={(e) => setInterviewAnswer(e.target.value)}
                    placeholder="用自己的话说就好……"
                  />
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (!interviewAnswer.trim()) {
                        notify('先写几句话，再一起看看结构');
                        return;
                      }
                      const checks = [
                        ['具体情况', /当时|负责|遇到|情况|背景/.test(interviewAnswer)],
                        ['采取的行动', /我|协调|沟通|整理|跟进|完成|处理/.test(interviewAnswer)],
                        ['结果或收获', /结果|完成|减少|提升|学到|后来|因此/.test(interviewAnswer)],
                      ];
                      setInterviewFeedback(
                        `回答结构自查：${
                          checks
                            .filter((x) => x[1])
                            .map((x) => x[0])
                            .join('、') || '还可以补充具体细节'
                        }。${checks.some((x) => !x[1]) ? '可以补充当时的情况、你采取的行动，以及实际结果或学到的事。' : '结构已经比较清楚。请检查是否准确体现你的真实贡献。'} 这是本地文字提示，不是AI面试评分。`,
                      );
                    }}
                  >
                    看看回答结构
                    <ArrowRight size={15} />
                  </button>
                  {interviewFeedback && (
                    <div className="gentle-box">
                      <Heart size={16} />
                      <p>{interviewFeedback}</p>
                    </div>
                  )}
                </div>
                <aside className="panel interview-tips">
                  <span className="small-cap">记得</span>
                  <h3>说真实的事，不用背模板。</h3>
                  <ul>
                    <li>说明你面对的具体情况</li>
                    <li>讲清楚你本人做了什么</li>
                    <li>如有结果，可用真实细节说明</li>
                    <li>没有数字也没关系，不要编造</li>
                  </ul>
                </aside>
              </div>
            )}
            {toolTab === 'weekly' && (
              <div className="panel plan-panel">
                <div className="panel-heading">
                  <div>
                    <span className="small-cap">每周求职行动</span>
                    <h2>{goal || '先选一个想尝试的岗位方向'}</h2>
                  </div>
                  <button className="btn secondary small" onClick={() => setPaused((x) => !x)}>
                    {paused ? <Play size={14} /> : <Pause size={14} />}
                    {paused ? '继续计划' : '暂停计划'}
                  </button>
                </div>
                <p className="muted-text">
                  一天最多做一件事。没完成也不会受到提醒或扣分，你可以随时调整。
                </p>
                {tasks.map((t, i) => (
                  <TaskLine
                    key={t.id}
                    task={t}
                    index={i}
                    onToggle={() => toggleTask(t.id)}
                    onEdit={() => {
                      const title = prompt('修改这项行动', t.title);
                      if (title?.trim())
                        setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, title } : x)));
                    }}
                    onDelete={() => setTasks((ts) => ts.filter((x) => x.id !== t.id))}
                  />
                ))}
                <div className="add-task">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="添加一件对你有帮助的小事"
                  />
                  <button className="btn secondary small" onClick={addTask}>
                    <Plus size={14} />
                    添加
                  </button>
                </div>
                <button
                  className="link-btn"
                  onClick={() => {
                    if (goal) setTasks(createTasks(goal));
                    notify('已恢复当前方向的建议计划');
                  }}
                >
                  <RotateCcw size={14} />
                  重新生成建议任务
                </button>
              </div>
            )}
            {toolTab === 'portfolio' && (
              <Portfolio selected={goal} tasks={profile.tasks} onSave={notify} />
            )}
          </section>
        )}
        {page === 'history' && (
          <section className="stage">
            <PageHeading
              eyebrow="我的记录"
              title="你已经走过的每一步"
              desc="分析记录和求职草稿保存在当前浏览器。你可以逐条删除或清空。"
              warm={comfort[5]}
            />
            <div className="history-list">
              {records.map((r) => (
                <article key={r.id} className="history-item">
                  <div className="history-icon">
                    <History size={18} />
                  </div>
                  <div>
                    <b>{r.title}</b>
                    <p>
                      {new Date(r.createdAt).toLocaleString('zh-CN')} · {r.summary}
                    </p>
                    {r.skills.length > 0 && <small>技能线索：{r.skills.join('、')}</small>}
                  </div>
                  <button
                    className="icon-button danger"
                    onClick={() => setRecords((rs) => rs.filter((x) => x.id !== r.id))}
                    aria-label="删除这条记录"
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
              {records.length === 0 && (
                <Empty
                  title="还没有保存的记录"
                  desc="完成经历整理、岗位对照或简历草稿后，记录会显示在这里。"
                  action={startProfile}
                />
              )}
            </div>
            <button
              className="btn secondary"
              onClick={() => {
                setRecords([]);
                notify('历史记录已清空');
              }}
              disabled={!records.length}
            >
              <Trash2 size={15} />
              清空历史记录
            </button>
          </section>
        )}
        {page === 'settings' && (
          <section className="stage settings-stage">
            <PageHeading
              eyebrow="个人设置"
              title="你的资料由你掌握"
              desc="基本体验无需注册。资料默认保存在当前浏览器，可随时删除。"
              warm="一次求职受挫，不代表你没有价值。"
            />
            <div className="panel settings-panel">
              <div>
                <h3>文字大小</h3>
                <p>按需放大或缩小页面文字。</p>
                <div className="setting-controls">
                  <button
                    className="btn secondary"
                    onClick={() => setFontScale((x) => Math.max(-1, x - 1))}
                  >
                    A− 缩小
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => setFontScale((x) => Math.min(2, x + 1))}
                  >
                    A+ 放大
                  </button>
                </div>
              </div>
              <div>
                <h3>演示数据</h3>
                <p>用示例经历体验功能。演示内容会明确标记，不会混入你的真实资料。</p>
                <button className="btn secondary" onClick={loadDemo}>
                  载入演示数据
                </button>
              </div>
              <div>
                <h3>删除本机资料</h3>
                <p>删除职业档案、简历草稿、行动计划和历史记录。删除后无法恢复。</p>
                <button className="btn danger-button" onClick={eraseData}>
                  <Trash2 size={15} />
                  删除我的资料
                </button>
              </div>
              <div className="privacy-block">
                <ShieldCheck size={16} />
                <span>
                  当前版本未连接真实 AI 服务。文本分析和面试提示均由本地规则生成；图片 OCR
                  使用随站点提供的本地语言模型，图片内容在浏览器内处理。
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
      {page !== 'home' && (
        <footer className="global-footer">
          <span>SECOND CURVE · 过去的经验，值得被重新看见。</span>
          <span>建议仅供参考；岗位与薪资信息请以真实来源为准。</span>
          <button onClick={() => go('history')}>求职进度</button>
        </footer>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  desc,
  warm,
  action,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  warm: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="small-cap">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{desc}</p>
        <div className="heading-warm">
          <Heart size={15} />
          {warm}
        </div>
      </div>
      {action}
    </div>
  );
}
function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  area,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  area?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}
function Empty({ title, desc, action }: { title: string; desc: string; action: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <FileText size={24} />
      </div>
      <h2>{title}</h2>
      <p>{desc}</p>
      <button className="btn primary" onClick={action}>
        继续整理
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function TaskLine({
  task,
  index,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  index: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`task-line ${task.done ? 'done' : ''}`}>
      <button
        className={`task-check ${task.done ? 'checked' : ''}`}
        onClick={onToggle}
        aria-label={task.done ? '取消完成' : '标记完成'}
      >
        {task.done && <Check size={14} />}
      </button>
      <span className="task-index">0{index + 1}</span>
      <div className="task-text">
        <b>{task.title}</b>
        <p>{task.detail}</p>
        <small>
          {task.hours} 小时 · 完成标准：{task.output}
        </small>
      </div>
      <div className="task-line-actions">
        <button className="icon-button" onClick={onEdit} aria-label="编辑行动">
          <Settings size={15} />
        </button>
        <button className="icon-button danger" onClick={onDelete} aria-label="删除行动">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
function Portfolio({
  selected,
  tasks,
  onSave,
}: {
  selected: string;
  tasks: string;
  onSave: (s: string) => void;
}) {
  const [saved, setSaved] = useState('');
  const [idea, setIdea] = useState('');
  return (
    <div className="portfolio-layout">
      <div className="panel portfolio-intro">
        <span className="small-cap">职业作品实验室</span>
        <h2>
          {selected.includes('客服') || selected.includes('客户')
            ? '客户服务流程改进练习'
            : selected.includes('销售')
              ? '客户管理与销售记录练习'
              : selected.includes('运营')
                ? '运营流程与数据整理练习'
                : '工作流程优化小项目'}
        </h2>
        <p>用虚构或脱敏数据，做一个能说明你如何解决问题的小作品。不要伪造过往项目或业绩。</p>
        <ol>
          <li>选一个你熟悉的工作场景</li>
          <li>写下遇到的问题和希望改善的地方</li>
          <li>制作一张流程图、表格或说明</li>
          <li>请一位信任的人看一看，记录反馈</li>
        </ol>
        <div className="deliverable">
          <b>可以展示的成果</b>
          <span>问题说明 · 过程记录 · 实际产出 · 复盘</span>
        </div>
      </div>
      <div className="panel">
        <Field
          label="记录作品进度或链接"
          value={idea}
          onChange={setIdea}
          area
          placeholder="写下已完成的部分，或粘贴作品链接。请不要放入原单位、客户的敏感资料。"
        />
        <button
          className="btn primary"
          onClick={() => {
            localStorage.setItem('sc-portfolio', idea);
            setSaved(idea);
            onSave('作品记录已保存在当前浏览器');
          }}
        >
          <Check size={15} />
          保存作品记录
        </button>
        {saved && <p className="save-hint">已保存。做过的事：{tasks.slice(0, 60)}</p>}
      </div>
    </div>
  );
}
