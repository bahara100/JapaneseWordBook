import { Icon } from '../art/icons';
import { PageTitle } from './PageTitle';

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
