import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const target = query ? `/app?${query}` : "/app";

  throw redirect(target);
};

export default function IndexRedirect() {
  return null;
}
