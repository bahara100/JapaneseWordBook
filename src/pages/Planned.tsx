import { Icon, type IconName } from '../art/icons';
import { PageTitle } from './PageTitle';

/** A section whose features are not built yet. Says so plainly and points to the design prototype. */
export function Planned({ eyebrow, heading, lead, icon, step, prototypeHash, detailId }: {
  eyebrow: string; heading: string; lead: string; icon: IconName;
  step: string; prototypeHash: string; detailId?: string;
}) {
  return (
    <>
      <PageTitle eyebrow={eyebrow} heading={heading} lead={lead} />
      <section className="empty">
        <div className="empty-mark" aria-hidden="true"><Icon name={icon} /></div>
        <h2>이 화면은 아직 만드는 중이에요.</h2>
        {detailId && <p>요청한 항목: <code>{detailId}</code></p>}
        <p>구현 계획 {step} 단계에서 연결해요. 완성될 모습은 디자인 시안에서 미리 볼 수 있어요.</p>
        <a className="btn primary" href={`${import.meta.env.BASE_URL}prototype/${prototypeHash}`}>
          디자인 시안에서 보기 <Icon name="arrow" />
        </a>
      </section>
    </>
  );
}

export function NotFound({ path }: { path: string }) {
  return (
    <>
      <PageTitle eyebrow="PAGE NOT FOUND" heading="찾는 화면이 없어요." lead="주소를 확인하거나 홈에서 다시 시작해 주세요." />
      <section className="empty">
        <div className="empty-mark" aria-hidden="true"><Icon name="search" /></div>
        <h2>없는 주소예요.</h2>
        <p><code>#/{path}</code></p>
        <a className="btn primary" href="#/home">홈으로 가기 <Icon name="arrow" /></a>
      </section>
    </>
  );
}
