import { redirect } from 'next/navigation'
export default async function UsersPage() {
  redirect('/admin/users')
}
