import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";
import { notFound, redirect } from "next/navigation";
import CreateProjectForm from "@/components/CreateProjectForm";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkspacePage({
  params,
}: PageProps) {
  const business = await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const { id } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      businessId: business.id,
    },
    include: {
      projects: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!workspace) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold">
        {workspace.name}
      </h1>

      <p className="text-gray-600 mt-3">
        {workspace.description || "No description"}
      </p>

      <div className="mt-8">
        <CreateProjectForm workspaceId={workspace.id} />
      </div>

      <div className="mt-8">
        {workspace.projects.length === 0 ? (
          <p>No projects yet.</p>
        ) : (
          <div className="space-y-4">
            {workspace.projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block border rounded-xl p-5 hover:bg-gray-50 transition"
              >
                <h2 className="font-bold text-lg text-blue-600">
                  {project.name}
                </h2>

                <p className="mt-2">
                  {project.description || "No description"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}