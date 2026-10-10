import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkspacePage({ params }: PageProps) {
  const { id } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: {
      id,
    },
  });

  if (!workspace) {
    notFound();
  }

  return (
    <main className="min-h-screen p-10 bg-gray-100">
      <div className="bg-white rounded-xl shadow p-8">

        <h1 className="text-3xl font-bold">
          {workspace.name}
        </h1>

        <p className="text-gray-600 mt-3">
          {workspace.description || "No description"}
        </p>

      </div>
    </main>
  );
}