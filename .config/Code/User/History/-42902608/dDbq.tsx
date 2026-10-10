import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";
import { notFound, redirect } from "next/navigation";

import CreateProjectForm from "@/components/CreateProjectForm";
import WorkspaceActions from "@/components/WorkspaceActions";

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
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {workspace.name}
          </h1>

          <p className="mt-3 text-gray-600">
            {workspace.description || "No description"}
          </p>
        </div>

        <WorkspaceActions
          workspaceId={workspace.id}
          workspaceName={workspace.name}
        />
      </div>

      <div className="mt-8">
        <CreateProjectForm
          workspaceId={workspace.id}
        />
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
                className="block rounded-xl border p-5 transition hover:bg-gray-50"
              >
                <h2 className="text-lg font-bold text-blue-600">
                  {project.name}
                </h2>

                <p className="mt-2">
                  {project.description ||
                    "No description"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}