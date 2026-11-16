// 文案解析：面向玩家的字串全部住在 locales/ 里，代码只持有 key 与参数。
// 纯数据 + 纯函数，不碰 DOM，Node 测试与浏览器共用同一份实现。
import zhCN from './locales/zh-CN.js';

const CATALOGS = { 'zh-CN': zhCN };
let current = 'zh-CN';

export const LOCALES = Object.keys(CATALOGS);
export const locale = () => current;
export function setLocale(id) { if (CATALOGS[id]) current = id; }

// 参数里可以再嵌一个 key。日志因此存的是「引用」而不是烘焙好的译文，
// 换语言时整段历史都能重译，而不是留着一半旧语言。
export const ref = (key, params) => ({ $: key, ...(params || {}) });

function resolve(v) {
  if (Array.isArray(v)) return v.map(resolve).filter((x) => x !== '').join(t('list.sep'));
  if (v && typeof v === 'object' && v.$) return t(v.$, v);
  return v == null ? '' : String(v);
}

export function t(key, params) {
  const cat = CATALOGS[current] || zhCN;
  const raw = cat[key] != null ? cat[key] : zhCN[key];
  if (raw == null) return key; // 缺键就把 key 本身露出来，开发期一眼看得见
  return raw.replace(/\{(\w+)\}/g, (_, k) => resolve(params ? params[k] : undefined));
}