import { redirect } from "next/navigation";

export default function Home() {
  // TODO(T2.6): มี session ? (มี active_family_id ? /dashboard : /onboarding) : /login
  redirect("/login");
}
