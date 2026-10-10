EOF

cat > components/kanban/KanbanBoard.tsx <<'EOF'
"use client";

import { useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";

import type { Task, TaskStatus } from "@/types/models";
import KanbanColumn from "./KanbanColumn";

export default function KanbanBoard({
  tasks,
}: {
  tasks: Task[];
}) {
  const [taskList, setTaskList] = useState<Task[]>(tasks);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const taskId = String(active.id);
    const newStatus = String(over.id) as TaskStatus;

    setTaskList((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status: newStatus as TaskStatus }
          : task
      )
    );

    try {
      const response = await fetch("/api/tasks/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task.");
      }
    } catch (error) {
      console.error(error);
      setTaskList(tasks);
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KanbanColumn
          id="TODO"
          title="🟡 TODO"
          tasks={taskList.filter((task) => task.status === "TODO")}
        />

        <KanbanColumn
          id="IN_PROGRESS"
          title="🔵 IN PROGRESS"
          tasks={taskList.filter(
            (task) => task.status === "IN_PROGRESS"
          )}
        />

        <KanbanColumn
          id="DONE"
          title="🟢 DONE"
          tasks={taskList.filter((task) => task.status === "DONE")}
        />
      </div>
    </DndContext>
  );
}
EOF

grep -n "substring\|toISOString" components/EditTaskModal.tsx
python3 - <<'PY'
from pathlib import Path

p = Path("components/EditTaskModal.tsx")
s = p.read_text()

s = s.replace(
    'task.dueDate.substring(0, 10)',
    'task.dueDate.toISOString().slice(0, 10)'
)

p.write_text(s)
print("EditTaskModal.tsx fixed.")
PY

grep -n "dueDate" components/EditTaskModal.tsx
cat > components/Modal.tsx <<'EOF'
"use client";

import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({
  open,
  title,
  children,
  onClose,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-bold">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-black"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
EOF

cat > components/TaskActions.tsx <<'EOF'
"use client";

import { toast } from "sonner";

export default function TaskActions({
  taskId,
}: {
  taskId: string;
}) {
  async function deleteTask() {
    const confirmed = window.confirm(
      "Delete this task?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        "/api/tasks/delete",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to delete task."
        );
      }

      toast.success("Task deleted.");
      window.location.reload();
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete task."
      );
    }
  }

  return (
    <button
      type="button"
      onClick={deleteTask}
      className="mt-3 text-red-600 text-sm hover:underline"
    >
      🗑 Delete
    </button>
  );
}
EOF

npx tsc --noEmit
ls
npx tsc --noEmit
npm run dev
mkdir -p components/project/ProjectWorkspace.tsx
rm -rf components/project/ProjectWorkspace.tsx
touch components/project/ProjectWorkspace.tsx
code .
cd pulse-web
touch components/project/ProjectWorkspace.tsx
code .
npx tsc --noEmit
npx prisma format
npx prisma validate
ls -la | grep .env
grep "^DATABASE_URL=" .env | sed 's/=.*/=***HIDDEN***/'
npx prisma validate
npx prisma format
cat prisma/schema.prisma
npx prisma migrate dev --name add_task_activity
npx prisma generate
npx prisma validate
npx prisma migrate dev --name add_task_activity
npx prisma migrate status
find prisma/migrations -maxdepth 2 -type f | sort
cat prisma/migrations/20260802193949_init/migration.sql
cat prisma/migrations/20260805205335_add_workspace_model/migration.sql
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
npx prisma migrate dev --name add_task_activity
mkdir -p prisma/migrations/20260809090000_baseline_project_task
cat > prisma/migrations/20260809090000_baseline_project_task/migration.sql <<'EOF'
-- Baseline existing Project and Task tables.
-- These objects already exist in the database.

CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "workspaceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueDate" TIMESTAMP(3),
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_workspaceId_fkey"
  FOREIGN KEY ("workspaceId")
  REFERENCES "Workspace"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "Project"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
EOF

npx prisma migrate resolve --applied 20260809090000_baseline_project_task
npx prisma migrate dev --name add_task_activity
npx tsc --noEmit
grep -n "activities" prisma/schema.prisma
grep -n "model TaskActivity" -A20 prisma/schema.prisma
npx prisma generate
npx tsc --noEmit
mkdir -p "app/api/tasks/[id]/activities"
touch "app/api/tasks/[id]/activities/route.ts"
ls -l "app/api/tasks/[id]/activities/route.ts"
code "app/api/tasks/[id]/activities/route.ts"
[200~npx tsc --noEmit~
npx tsc --noEmit
touch components/TaskActivity.tsx
code components/TaskActivity.tsx
npx tsc --noEmit
find components -maxdepth 2 -type f | sort | grep -Ei "task|modal"
npx tsc --noEmit
all working bro
find app/api -type f | sort | grep -i task
cat "app/api/tasks/route.ts"
npx tsc --noEmit
npx prisma studio
curl -i "http://localhost:3000/api/tasks/cmsh8knlw0001m91snuasmblc/activities"
npx prisma validate
npx prisma migrate status
npx prisma db pull
getent hosts ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech
nc -vz ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech 5432
sudo apt update && sudo apt install -y netcat-openbsd
nc -vz ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech 5432
grep "^DATABASE_URL=" .env | cut -c1-35
grep "^DATABASE_URL=" .env | grep -o "sslmode=[^&]*"
node -e "require('dotenv').config(); const u=new URL(process.env.DATABASE_URL); console.log({protocol:u.protocol,host:u.hostname,port:u.port,database:u.pathname,sslmode:u.searchParams.get('sslmode')})"
node -e "require('dotenv').config(); const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.$connect().then(()=>{console.log('DATABASE CONNECTION OK'); return p.$disconnect()}).catch(e=>{console.error(e); process.exit(1)})"
node -e 'require("dotenv").config(); const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient(); p.$connect().then(() => { console.log("DATABASE CONNECTION OK"); return p.$disconnect(); }).catch(e => { console.error(e); process.exit(1); })'
curl -i "http://localhost:3000/api/tasks/cmsh8knlw0001m91snuasmblc/activities"
cat "app/api/tasks/[id]/activities/route.ts"
find "app/api/tasks/[id]/activities" -maxdepth 1 -type f -ls
curl -s "http://localhost:3000/api/tasks/cmsh8knlw0001m91snuasmblc/activities"
npx prisma studio
rm -rf .next
npm run dev
npx prisma studio
top
cd pulse-web
npm run dev
code .
npm run dev
cat "app/api/tasks/update/route.ts"
npx tsc --noEmit
grep -R "cmsh" .next/dev/server 2>/dev/null | head
cat "components/kanban/KanbanBoard.tsx"
npx tsc --noEmit
cat "app/api/tasks/edit/route.ts"
npx tsc --noEmit
cat "app/api/tasks/delete/route.ts"
pwd
ls -la "app/api/tasks/delete"
cat "app/api/tasks/delete/route.ts"
npx tsc --noEmit
npm run build
rm -rf .next
npm run build
cd ~/pulse-web
ls -la .next
ls -lt /tmp/next-panic-*.log | head
tail -30 /tmp/next-panic-*.log
free -h
df -h /
swapon --show
cat /proc/swaps
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
cat /proc/swaps
sudo rm /swapfile
cat /proc/swaps
npx next --version
grep '"build"' package.json
npx next build --help | grep -i webpack
rm -rf .next
npx next build --webpack
git status
git add -A
git status
git commit -m "Add task management and activity tracking"
git status
cat prisma/schema.prisma
cd ~/pulse-web
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error(e.message); process.exit(1)})'
DB CONNECTION OK
sleeky3750@penguin:~/pulse-web$ node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error(e.message); process.exit(1)})'
Can't reach database server at `ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech:5432`

Please make sure your database server is running at `ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech:5432`.
sleeky3750@penguin:~/pulse-web$ node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error(e.message); process.exit(1)})'
DB CONNECTION OK
sleeky3750@penguin:~/pulse-web$ 
grep "^DATABASE_URL=" .env | sed -E 's#(postgresql://[^:]+:)[^@]+@#\1****@#'
cp .env .env.backup
sed -i 's/&channel_binding=require//' .env
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error(e.message); process.exit(1)})'
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error("DB FAILED:",e.message); process.exit(1)})'
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error("DB FAILED:",e.message); process.exit(1)})'node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error("DB FAILED:",e.message); process.exit(1)})'
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error("DB FAILED:",e.message); process.exit(1)})'
cd ~/pulse-web
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error("DB FAILED:",e.message); process.exit(1)})'
npm run dev
cat app/api/login/route.ts
cat app/api/signup/route.ts
grep -R "businessId" -n app components lib | head -50
cat app/api/tasks/route.ts
cat app/api/tasks/update/route.ts
cat app/api/tasks/edit/route.ts
mkdir -p lib/auth
touch lib/auth/business.ts
ls -la lib/auth
code lib/auth/business.ts
code .
npx tsc --noEmit
code app/api/tasks/route.ts
npx tsc --noEmit
git status
git restore --staged components/CreateWorkspaceForm.tsx.save
git commit -m "Add business authentication and improve task updates"
git push
git status
git add components/EditTaskModal.tsx components/Modal.tsx
git status
git commit -m "Update task modal components"
git status
rm components/CreateWorkspaceForm.tsx.save
git status
npx tsc --noEmit
cat app/api/projects/route.ts
grep -R "prisma.project" -n app components | head -100
cat "app/project/[id]/page.tsx"
code "app/project/[id]/page.tsx"
npx tsc --noEmit
cat app/dashboard/page.tsx
cat "app/workspace/[id]/page.tsx"
npx tsc --noEmit
git status
git add -A
git status
git commit -m "secure workspace and project ownership"
git push
git status
find app components lib -maxdepth 3 -type f | sort
cat package.json
cd ~/pulse-web
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error("DB FAILED:",e.message); process.exit(1)})'
find app components -type f | grep -Ei 'logout|signout|auth'
mkdir -p app/api/logout
code app/api/logout/route.ts
npx tsc --noEmit
cd pulse-web
code .
npx tsc --noEmit
code app/error.tsx
npx tsc --noEmit
code app/not-found.tsx
npx tsc --noEmit
git status
git add -A
git commit -m "finish core MVP authentication and error states"
git status
git push
git status
npx next build --webpack
git status
cat package.json
git log -1 --oneline
git show HEAD:package.json | grep '"next"'
git push origin master
cat app/api/workspaces/route.ts
cat components/CreateWorkspaceForm.tsx
code components/CreateWorkspaceForm.tsx
npx tsc --noEmit
git add components/CreateWorkspaceForm.tsx
git commit -m "fix workspace form submission"
git push
cat app/signup/page.tsx
cat app/signup/page.tsx > /tmp/signup-page.txt
sed -n '1,260p' app/signup/page.tsx
sed -n '261,520p' app/signup/page.tsx
nl -ba app/signup/page.tsx | sed -n '35,180p'
npx tsc --noEmit
npm run dev
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$connect().then(()=>{console.log("DB CONNECTION OK"); return p.$disconnect()}).catch(e=>{console.error(e.message); process.exit(1)})'
cat lib/prisma.ts
node -e 'require("dotenv").config(); console.log(process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"))'
npx prisma db pull
cat prisma.config.ts
npx prisma generate
npm run dev
nano prisma/schema.prisma
npx prisma format
npx prisma validate
git diff -- prisma/schema.prisma
npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT "migration_name", "finished_at"
FROM "_prisma_migrations"
ORDER BY "started_at";
SQL

node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$queryRawUnsafe(`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`).then(r=>console.log(r)).catch(console.error).finally(()=>p.$disconnect())'
ls -la prisma/migrations
git status
git log --oneline -- prisma/migrations | head -20
git diff -- prisma/schema.prisma
git show --stat --oneline a04d1dd
git show --stat --oneline a02db80
git show a04d1dd -- prisma/migrations/20260809081936_add_task_activity/migration.sql prisma/migrations/20260809090000_baseline_project_task/migration.sql
npx prisma migrate dev --name add_ai_jobs
npx prisma migrate status
npx prisma db pull
node -e 'require("dotenv").config(); console.log(process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"))'
npx prisma migrate status
node -e 'require("dotenv").config(); const {Client}=require("pg"); const c=new Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>{console.log("DB CONNECTED");return c.end()}).catch(e=>{console.error(e.message);process.exit(1)})'
npx prisma migrate status
cat prisma/schema.prisma | tail -60
npx prisma format
npx prisma validate
npx prisma generate
npx prisma db push
psql "$DATABASE_URL" -c "SELECT 1;"
which psql
nano prisma.config.ts
npx prisma migrate status
npx prisma migrate dev --name add_ai_jobs
npx prisma migrate status
git status
rm -- 'ma migrate diff \'
rm -- 'ma migrate diff \\'
git status
git add prisma.config.ts prisma/schema.prisma prisma/migrations
git status
git commit -m "Add AI job database foundation"
git push origin master
mkdir -p app/api/ai/create-job
mkdir -p app/api/ai/process
mkdir -p lib/ai
cat > lib/ai/groq.ts <<'EOF'
export async function askGroq(prompt: string) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  return data.choices[0].message.content;
}
EOF

cat > lib/ai/groq.ts <<'EOF'
export async function askGroq(prompt: string) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  return data.choices[0].message.content;
}
EOF

cat lib/ai/groq.ts
cat > app/api/ai/create-job/route.ts <<'EOF'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const job = await prisma.aIJob.create({
      data: {
        businessId: body.businessId,
        type: body.type,
        input: body.input,
      },
    });

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create AI job",
      },
      {
        status: 500,
      }
    );
  }
}
EOF

npx prisma migrate diff   --from-schema-datasource   --to-schema-datamodel prisma/schema.prisma   --script > /tmp/add_ai_jobs.sql
cat /tmp/add_ai_jobs.sql
npx prisma migrate diff   --from-url="$DATABASE_URL"   --to-schema-datamodel=prisma/schema.prisma   --script
cp -r prisma/migrations /tmp/pulse-migrations-backup
ls /tmp/pulse-migrations-backup
mv prisma/migrations/20260809090000_baseline_project_task    prisma/migrations/20260809081800_baseline_project_task
ls -la prisma/migrations
npx prisma migrate status
node -e 'require("dotenv").config(); const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.$executeRawUnsafe(`DELETE FROM "_prisma_migrations" WHERE migration_name = '\''20260809090000_baseline_project_task'\''`).then(r=>console.log("Deleted:",r)).catch(console.error).finally(()=>p.$disconnect())'
npx prisma migrate resolve --applied 20260809081800_baseline_project_task
npx prisma migrate status
npx prisma migrate dev --name add_ai_jobs
cat lib/ai/groq.ts
cat app/api/ai/create-job/route.ts
cat app/api/ai/process/route.ts
cat > app/api/ai/create-job/route.ts <<'EOF'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const job = await prisma.aIJob.create({
      data: {
        businessId: body.businessId,
        type: body.type,
        input: body.input,
      },
    });

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create AI job",
      },
      {
        status: 500,
      }
    );
  }
}
EOF

cat app/api/ai/create-job/route.ts
npx tsc --noEmit
nano .env
grep -q '^GROQ_API_KEY=' .env && echo "GROQ_API_KEY is set"
node -e "require('dotenv').config(); console.log(process.env.GROQ_API_KEY ? 'GROQ_API_KEY detected' : 'GROQ_API_KEY missing')"
node - <<'EOF'
require("dotenv").config();

async function testGroq() {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: "Reply with exactly: Pulse AI is online.",
          },
        ],
      }),
    }
  );

  const data = await response.json();

  console.log("Status:", response.status);
  console.log("Response:", data.choices?.[0]?.message?.content || data);
}

testGroq();
EOF

cat > lib/ai/groq.ts <<'EOF'
export async function askGroq(prompt: string) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are Pulse AI, an intelligent business project planning assistant. Always follow the user's requested output format exactly.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Groq API request failed"
    );
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response");
  }

  return content;
}
EOF

cat lib/ai/groq.ts
cat > lib/ai/projectPlanner.ts <<'EOF'
import { askGroq } from "@/lib/ai/groq";

export type ProjectPlan = {
  name: string;
  description: string;
  tasks: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }[];
};

export async function generateProjectPlan(
  projectIdea: string
): Promise<ProjectPlan> {
  const prompt = `
Create a practical project plan for the following business project:

"${projectIdea}"

Return ONLY valid JSON.

Use exactly this structure:

{
  "name": "Project name",
  "description": "Short project description",
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "priority": "LOW"
    }
  ]
}

Rules:
- Generate between 5 and 10 useful tasks.
- Tasks must be practical and actionable.
- Use only LOW, MEDIUM, or HIGH for priority.
- Do not include markdown.
- Do not include explanations outside the JSON.
`;

  const result = await askGroq(prompt);

  let parsed: ProjectPlan;

  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error("AI returned invalid project plan JSON");
  }

  if (
    !parsed.name ||
    !parsed.description ||
    !Array.isArray(parsed.tasks)
  ) {
    throw new Error("AI returned an invalid project plan structure");
  }

  return parsed;
}
EOF

cat lib/ai/projectPlanner.ts
npx tsc --noEmit
cd pulse-web
sed -i '/workspaces    Workspace\[\]/a\  aiJobs        AIJob[]' prisma/schema.prisma
npx prisma format
npx prisma validate
sed -i '0,/aiJobs        AIJob\[\]/{//d;}' prisma/schema.prisma
npx prisma format
npx prisma validate
git diff -- prisma/schema.prisma
curl -X POST http://localhost:3000/api/ai/create-job   -H "Content-Type: application/json"   -d '{
    "businessId": "cmsn1rpv20000m9trlt0dhafj",
    "type": "PROJECT_PLANNING",
    "input": {
      "projectIdea": "Launch a reliable same-day delivery business in Lagos"
    }
  }'
curl -X POST http://localhost:3000/api/ai/process
npx tsc --noEmit
grep -n "aIJob\|AIJob" node_modules/.prisma/client/index.d.ts | head -20
npx prisma generate
npx tsc --noEmit
npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT "id", "businessName", "email"
FROM "Business"
ORDER BY "createdAt" DESC
LIMIT 5;
SQL

npx prisma studio
npm run dev
cat components/CreateWorkspaceForm.tsx
git add -A
git commit -m "improve signup and workspace feedback"
git push
cat prisma/schema.prisma
npx prisma format
npx prisma validate
npx prisma migrate dev --name add_ai_jobs
ls -la prisma/migrations
for d in prisma/migrations/*; do   echo "===== $d =====";   ls "$d"; done
cat prisma/migrations/20260809081936_add_task_activity/migration.sql
cat prisma/migrations/20260809090000_baseline_project_task/migration.sql
npx prisma migrate status
cat prisma/migrations/20260802193949_init/migration.sql
cat prisma/migrations/20260805205335_add_workspace_model/migration.sql
npx prisma db execute --stdin <<'SQL'
SELECT "migration_name", "finished_at"
FROM "_prisma_migrations"
ORDER BY "started_at";
SQL

npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT "migration_name", "finished_at"
FROM "_prisma_migrations"
ORDER BY "started_at";
SQL

npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT "migration_name", "finished_at"
FROM "_prisma_migrations"
ORDER BY "started_at";
SQL

Loaded Prisma config from prisma.config.ts.
Prisma config detected, skipping environment variable loading.
Error: P1001
Can't reach database server at `ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech:5432`

Please make sure your database server is running at `ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech:5432`.

sleeky3750@penguin:~/pulse-web$ 
npx prisma studio
npm run dev
npx prisma@6.19.3 studio
cd pulse-web
npx prisma studio
curl -X POST http://localhost:3000/api/ai/create-project   -H "Content-Type: application/json"   -d '{
    "jobId": "cmsobdbgd0001m9r4eaocp13p",
    "workspaceId": "cmsn221j10004m9tr2emkesbr"
  }'
code .
npx tsc --noEmit
find app -maxdepth 3 -type f | sort
cat app/dashboard/page.tsx
npx tsc --noEmit
cat lib/ai/projectPlanner.ts
npx tsc --noEmit
grep -n "function createProject\|function addTask\|setPlan" components/ai/ProjectPlanner.tsx
npx tsc --noEmit
cat prisma/schema.prisma
cat app/dashboard/page.tsx
npx tsc --noEmit
cat lib/ai/groq.ts
cat lib/prisma.ts
find app/api/ai -maxdepth 2 -type f -print
mkdir -p app/api/ai/assistant
mkdir -p components/ai
cat app/api/tasks/route.ts
cat app/api/projects/route.ts
cat components/ai/PulseAssistant.tsx
npx tsc --noEmit
cd pulse-web
npm run dev
cat app/api/ai/assistant/route.ts
code .
code app/api/ai/assistant/route.ts
npx tsc --noEmit
mkdir -p app/api/ai/analyze
code app/api/ai/analyze/route.ts
cd pulse-web
curl -X POST http://localhost:3000/api/ai/analyze -H "Content-Type: application/json" -d '{"mode":"TODAY"}'
npm run dev
curl -X POST http://localhost:3000/api/ai/analyze -H "Content-Type: application/json" -d '{"mode":"TODAY"}'
curl -X POST http://localhost:3000/api/ai/analyze -H "Content-Type: application/json" -d '{"mode":"TODAY"}'
mkdir -p components/ai
code components/ai/TodayFocus.tsx
code .
code components/ai/TodayFocus.tsx
npx tsc --noEmit
cat 'app/workspace/[id]/page.tsx'
cat components/project/ProjectOverview.tsx
cat components/project/ProjectWorkspace.tsx
cat components/TaskActions.tsx
cat components/EditTaskModal.tsx
cat components/DeleteTaskButton.tsx
cd pulse-web
npm run dev
cocde .
code .
npx tsc --noEmit
cat app/api/ai/refine-plan/route.ts
cat components/ai/ProjectPlanner.tsx
npx tsc --noEmit
cat app/api/workspaces/route.ts
cat app/api/projects/route.ts
cat app/api/tasks/route.ts
find app/workspace -maxdepth 3 -type f -print
find components -maxdepth 3 -type f -print
cat components/project/ProjectWorkspace.tsx
npx tsc --noEmit
cd pulse-web
code .
npx tsc --noEmit
git add app/api/workspaces/route.ts
git commit -m "Enable workspace deletion"
git push origin master
cat app/api/projects/route.ts
npx tsc --noEmit
git add app/api/projects/route.ts
git commit -m "Enable project deletion"
git push origin master
npm run dev
cat components/WorkspaceActions.tsx
cat lib/ai/businessContext.ts
cat lib/ai/groq.ts
cat app/api/ai/recommendations/route.ts
curl http://localhost:3000/api/ai/insights
curl http://localhost:3000/api/ai/recommendations
cat components/ai/TodayFocus.tsx
cat components/ai/PulseInsights.tsx
cat lib/ai/recommendations.ts
cat lib/ai/groq.ts
npx tsc no-Emit
npx tsc --noEmit
cat app/layout.tsx
npm run build
cd pulse-web
cat app/globals.css
code .
npm run dev
cd pulse-web
npm run build
npm run dev
code .
npm run dev
codex
if [ -n "$DATABASE_URL" ]; then echo "DATABASE_URL is set"; else echo "DATABASE_URL is missing"; fi
ping -c 3 ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech
nc -vz ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech 5432
cat prisma.config.ts
ls -la | grep -E '\.env'
npm ls pg
cat /etc/resolv.conf
sudo sh -c 'printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > /etc/resolv.conf'
getent ahosts ep-muddy-glitter-ax5hhasv-pooler.c-4.us-east-2.aws.neon.tech
npx prisma migrate status
cd pulse-web
codex
cd /home/sleeky3750/pulse-web
printf '\n--- DASHBOARD ---\n'
wc -l app/dashboard/page.tsx
sed -n '1,220p' app/dashboard/page.tsx
printf '\n--- WORKSPACE ---\n'
wc -l 'app/workspace/[id]/page.tsx'
sed -n '1,220p' 'app/workspace/[id]/page.tsx'
grep -n -E 'model (Workspace|Project|Task)|tasks.*Project|projects.*Workspace' prisma/schema.prisma
sed -n '23,58p' prisma/schema.prisma
code .
EOF
head -n 5 app/dashboard/page.tsx
tail -n 5 app/dashboard/page.tsx
sed -i '1d;$d' app/dashboard/page.tsx
head -n 3 app/dashboard/page.tsx
tail -n 3 app/dashboard/page.tsx
npm run build
wc -l 'app/project/[id]/page.tsx'
sed -n '1,220p' 'app/project/[id]/page.tsx'
ls -l components/WorkspaceActions.tsx
ls -l components/WorkspaceActions.tsxx
ls: cannot access 'components/WorkspaceActions.tsx': No such file or directory
sleeky3750@penguin:~/pulse-web$ ls -l components/WorkspaceActions.tsx
ls -l components/WorkspaceActions.tsx
npm run build
npm run dev
curl -I http://localhost:3000/dashboard
wc -l components/project/ProjectWorkspace.tsx
sed -n '1,260p' components/project/ProjectWorkspace.tsx
sed -n '250,470p' components/project/ProjectWorkspace.tsx
sed -n '470,692p' components/project/ProjectWorkspace.tsx
code .
npm run build
curl -I http://localhost:3000/dashboard
[200~rm -rf .next
rm -rf .next
npm run dev
cd /workspaces/Pulse
cd pulse-web
git diff -- components/CreateProjectForm.tsx components/CreateTaskForm.tsx components/CreateWorkspaceForm.tsx components/DeleteTaskButton.tsx components/EditTaskModal.tsx components/LogoutButton.tsx app/error.tsx app/globals.css app/layout.tsx app/loading.tsx app/not-found.tsx
ls
pwd
git status --short
git diff -- app/error.tsx
git rev-parse --show-toplevel
git log --oneline -8
git branch --show-current
git remote -v
git diff -- package.json
git diff -- components/project/ProjectWorkspace.tsx
find app/api/ai components/ai lib/ai -type f | sort
sed -n '1,260p' components/ai/PulseAiPanel.tsx
sed -n '1,260p' app/api/ai/route.ts
sed -n '1,260p' app/api/ai/actions/route.ts
sed -n '1,300p' lib/ai/core/client.ts
sed -n '1,320p' lib/ai/core/execute.ts
sed -n '1,320p' lib/ai/context/loadBusinessContext.ts
sed -n '1,320p' lib/ai/services/shared.ts
sed -n '1,320p' lib/ai/services/assistant.ts
sed -n '1,320p' lib/ai/services/planning.ts
sed -n '1,320p' lib/ai/services/insights.ts
sed -n '1,320p' lib/ai/services/priorities.ts
sed -n '1,320p' lib/ai/services/progress.ts
sed -n '1,400p' lib/ai/tools/actions.ts
sed -n '1,400p' lib/ai/schemas/actions.ts
sed -n '1,400p' lib/ai/schemas/responses.ts
sed -n '1,300p' lib/ai/schemas/requests.ts
sed -n '1,400p' lib/ai/tools/ownership.ts
sed -n '1,400p' lib/ai/context/references.ts
sed -n '1,300p' components/ai/AiActionConfirmation.tsx
echo "$GROQ_MODEL"
grep -E '^GROQ_MODEL=' .env .env.local 2>/dev/null
echo "${GROQ_API_KEY:+GROQ_API_KEY is set}"
ls -la | grep -E '\.env'
grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | cut -d= -f1
curl -s https://api.groq.com/openai/v1/models   -H "Authorization: Bearer $(grep '^GROQ_API_KEY=' .env | cut -d= -f2-)"   | grep -o '"id":"[^"]*"' | grep -E 'gpt-oss|llama'
curl -i https://api.groq.com/openai/v1/models   -H "Authorization: Bearer $(grep '^GROQ_API_KEY=' .env | cut -d= -f2-)"
nano .env
curl -s -o /dev/null -w "%{http_code}\n"   https://api.groq.com/openai/v1/models   -H "Authorization: Bearer $(grep '^GROQ_API_KEY=' .env | cut -d= -f2-)"
grep '^GROQ_API_KEY=' .env | sed 's/=.*/=<redacted>/'
nano .env
curl -s -o /dev/null -w "%{http_code}\n"   https://api.groq.com/openai/v1/models   -H "Authorization: Bearer $(grep '^GROQ_API_KEY=' .env | cut -d= -f2-)"
nano .env
curl -s -o /dev/null -w "%{http_code}\n"   https://api.groq.com/openai/v1/models   -H "Authorization: Bearer $(grep '^GROQ_API_KEY=' .env | cut -d= -f2-)"
grep '^GROQ_MODEL=' .env
npm run dev
git branch -a
git log --all --oneline --decorate -15
git diff --stat 9e1cf65 00c7b30
git diff --name-status 9e1cf65 00c7b30
git show 00c7b30:app/dashboard/page.tsx | sed -n '1,420p'
git show 00c7b30:app/workspace/'[id]'/page.tsx | sed -n '1,320p'
git show 00c7b30:components/WorkspaceActions.tsx | sed -n '1,320p'
{   git diff 9e1cf65 00c7b30 -- app/api/workspaces/route.ts;   git diff 9e1cf65 00c7b30 -- app/api/projects/route.ts;   git diff 9e1cf65 00c7b30 -- app/api/tasks/route.ts; } > /tmp/pulse-api-diff.txt
git diff 9e1cf65 00c7b30 -- app/api/workspaces/route.ts
cd pulse-web
npm build
run npm build
npm run build
npm run dev
wc -l components/kanban/KanbanBoard.tsx
sed -n '1,260p' components/kanban/KanbanBoard.tsx
wc -l components/kanban/KanbanColumn.tsx
sed -n '1,240p' components/kanban/KanbanColumn.tsx
wc -l components/kanban/TaskCard.tsx
sed -n '1,260p' components/kanban/TaskCard.tsx
wc -l components/TaskActions.tsx
sed -n '1,260p' components/TaskActions.tsx
code .
npm run build
[200~wc -l components/TaskStatus.tsx
sed -n '1,220p' components/TaskStatus.tsx~
wc -l components/TaskStatus.tsx
sed -n '1,220p' components/TaskStatus.tsx
grep -R 'TaskStatus' -n --exclude-dir=node_modules --exclude-dir=.next .
grep -R --include="*.tsx" --include="*.ts" "TaskStatus" app components lib
sed -n '1,180p' components/kanban/KanbanBoard.tsx
sed -n '1,130p' components/kanban/TaskCard.tsx
sed -n '1,100p' components/kanban/KanbanColumn.tsx
npm run build
grep -n -A6 -B2 "TaskCard" components/kanban/KanbanColumn.tsx
grep -n "onStatusChange" components/kanban/KanbanColumn.tsx
npm run build
sed -n '1,220p' components/TaskActions.tsx
sed -n '1,260p' components/EditTaskModal.tsx
sed -n '1,220p' components/TaskActivity.tsx
sed -n '1,220p' components/Modal.tsx
grep -n -A35 -B5 "export.*Task" types/models.ts
grep -R --include="*.tsx" --include="*.ts" "EditTaskModal" app components lib
npm run build
cd pulse-web
npm run build
npm run dev
find . -maxdepth 3 -type f   ! -path "./node_modules/*"   ! -path "./.next/*"   ! -path "./.git/*"   | sort > repo-files.txt
cat repo-files.txt
printf '\n===== PACKAGE =====\n'
cat package.json
printf '\n===== PRISMA SCHEMA =====\n'
cat prisma/schema.prisma
printf '\n===== API ROUTES =====\n'
find app/api -type f 2>/dev/null | sort
printf '\n===== LIB =====\n'
find lib -type f | sort
printf '\n===== COMPONENTS =====\n'
find components -type f | sort
printf '\n===== AUTH =====\n'
cat lib/auth/business.ts
printf '\n===== WORKSPACES =====\n'
cat app/api/workspaces/route.ts
printf '\n===== PROJECTS =====\n'
cat app/api/projects/route.ts
zip -r pulse-source.zip   app components lib prisma types   package.json package-lock.json   tsconfig.json next.config.ts   eslint.config.mjs postcss.config.mjs   prisma.config.ts README.md   -x "*/node_modules/*" "*/.next/*" "*.env*" "*.git/*"
zip -r pulse-source.zip app components lib prisma types package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs prisma.config.ts README.md
tar -czf pulse-source.tar.gz app components lib prisma types package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs prisma.config.ts README.md
ls -lh pulse-source.tar.gz
openssl rand -hex 32
npm run build
cd pulse-web
npm run build
npm run dev
npm run build
sed -n '1,240p' app/api/tasks/route.ts
sed -n '1,240p' app/api/tasks/edit/route.ts
sed -n '1,220p' app/api/tasks/update/route.ts
sed -n '1,220p' app/api/tasks/delete/route.ts
sed -n '1,220p' app/api/workspaces/route.ts
sed -n '1,220p' app/api/projects/route.ts
npm run build
cd ~/pulse-web
git status --short
git diff --stat
rm -f pulse-source.tar.gz repo-files.txt
git status --short
cat .gitignore
sed -n '1,240p' app/api/login/route.ts
sed -n '1,220p' lib/auth/session.ts
sed -n '1,220p' lib/auth/business.ts
cd pulse-web
code .
npm run build
sed -n '1,220p' app/dashboard/page.tsx
mkdir -p app/settings app/api/business
ls -ld app/settings app/api/business
cat > app/settings/page.tsx <<'EOF'
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/auth/business";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const business = await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
        <header className="flex items-center justify-between">
          <div>
            <a
              href="/dashboard"
              className="text-xl font-semibold tracking-tight text-gray-950"
            >
              Pulse
            </a>
            <p className="mt-1 text-sm text-gray-500">
              Business settings
            </p>
          </div>

          <a
            href="/dashboard"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-950"
          >
            ← Dashboard
          </a>
        </header>

        <section className="mt-12">
          <p className="text-sm font-medium text-gray-500">Settings</p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            Business settings
          </h1>

          <p className="mt-3 text-gray-500">
            Manage the information Pulse uses for your business.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <SettingsForm
            initialData={{
              businessName: business.businessName,
              email: business.email,
              phone: business.phone ?? "",
              businessType: business.businessType ?? "",
            }}
          />
        </section>
      </div>
    </main>
  );
}
EOF

cat > components/SettingsForm.tsx <<'EOF'
"use client";

import { useState } from "react";
import { toast } from "sonner";

interface SettingsFormProps {
  initialData: {
    businessName: string;
    email: string;
    phone: string;
    businessType: string;
  };
}

export default function SettingsForm({ initialData }: SettingsFormProps) {
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/business", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save settings.");
      }

      toast.success("Settings saved.");
    } catch (error) {
      console.error("Settings update failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">
          Business information
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Keep your business details up to date.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Business name
          </span>
          <input
            value={form.businessName}
            onChange={(event) =>
              updateField("businessName", event.target.value)
            }
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-950 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Business type
          </span>
          <input
            value={form.businessType}
            onChange={(event) =>
              updateField("businessType", event.target.value)
            }
            placeholder="e.g. Retail, Logistics, Agency"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-950 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-950 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Phone</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+234..."
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-950 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />
        </label>
      </div>

      <div className="flex justify-end border-t border-gray-100 pt-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
EOF

cat > app/api/business/route.ts <<'EOF'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

export async function PATCH(request: Request) {
  try {
    const business = await getCurrentBusiness();

    if (!business) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const businessName =
      typeof body.businessName === "string"
        ? body.businessName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const businessType =
      typeof body.businessType === "string"
        ? body.businessType.trim()
        : "";

    if (!businessName || !email) {
      return NextResponse.json(
        {
          success: false,
          message: "Business name and email are required.",
        },
        { status: 400 }
      );
    }

    const emailOwner = await prisma.business.findFirst({
      where: {
        email,
        NOT: {
          id: business.id,
        },
      },
    });

    if (emailOwner) {
      return NextResponse.json(
        {
          success: false,
          message: "That email is already in use.",
        },
        { status: 409 }
      );
    }

    const updatedBusiness = await prisma.business.update({
      where: {
        id: business.id,
      },
      data: {
        businessName,
        email,
        phone: phone || null,
        businessType: businessType || null,
      },
    });

    return NextResponse.json({
      success: true,
      business: {
        id: updatedBusiness.id,
        businessName: updatedBusiness.businessName,
        email: updatedBusiness.email,
        phone: updatedBusiness.phone,
        businessType: updatedBusiness.businessType,
      },
    });
  } catch (error) {
    console.error("Business settings update failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update business settings.",
      },
      { status: 500 }
    );
  }
}
EOF

npm run build
npm run dev
sed -n '1,180p' prisma/schema.prisma
git status --short
cp prisma/schema.prisma /tmp/pulse-schema-from-neon.prisma
git grep -n "AIJob\|AIJobStatus\|AIJobType" HEAD
git grep -n "AIJob\|AIJobStatus\|AIJobType" backup-before-ai-reset -- 2>/dev/null
npx prisma db execute --stdin <<'SQL'
SELECT
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count,
  logs
FROM "_prisma_migrations"
ORDER BY started_at;
SQL

npx prisma db execute --stdin <<'SQL'
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('Business','Workspace','Project','Task','TaskActivity','AIJob')
ORDER BY table_name;
SQL

npx prisma db execute --stdin <<'SQL'
SELECT
  typname
FROM pg_type
WHERE typname IN ('TaskStatus','TaskPriority','TaskActivityType','AIJobType','AIJobStatus')
ORDER BY typname;
SQL

npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count,
  logs
FROM "_prisma_migrations"
ORDER BY started_at;
SQL

npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('Business','Workspace','Project','Task','TaskActivity','AIJob')
ORDER BY table_name;
SQL

npx prisma db execute --schema=prisma/schema.prisma --stdin <<'SQL'
SELECT
  typname
FROM pg_type
WHERE typname IN ('TaskStatus','TaskPriority','TaskActivityType','AIJobType','AIJobStatus')
ORDER BY typname;
SQL

node -e '
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name, started_at, finished_at, rolled_back_at,
           applied_steps_count, logs
    FROM "_prisma_migrations"
    ORDER BY started_at
  `);

  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '\''public'\''
      AND table_name IN ('\''Business'\'','\''Workspace'\'','\''Project'\'','\''Task'\'','\''TaskActivity'\'','\''AIJob'\'')
    ORDER BY table_name
  `);

  const enums = await prisma.$queryRawUnsafe(`
    SELECT typname
    FROM pg_type
    WHERE typname IN ('\''TaskStatus'\'','\''TaskPriority'\'','\''TaskActivityType'\'','\''AIJobType'\'','\''AIJobStatus'\'')
    ORDER BY typname
  `);

  console.log("\\n=== MIGRATIONS ===");
  console.dir(migrations, { depth: null });

  console.log("\\n=== TABLES ===");
  console.dir(tables, { depth: null });

  console.log("\\n=== ENUMS ===");
  console.dir(enums, { depth: null });

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
'
git show backup-before-ai-reset:prisma/migrations/20260809081800_baseline_project_task/migration.sql
git show backup-before-ai-reset:prisma/migrations/20260811005337_add_ai_jobs/migration.sql
sed -n '1,260p' prisma/migrations/20260802193949_init/migration.sql
sed -n '1,260p' prisma/migrations/20260805205335_add_workspace_model/migration.sql
sed -n '1,320p' prisma/migrations/20260809081936_add_task_activity/migration.sql
sed -n '1,320p' prisma/migrations/20260809090000_baseline_project_task/migration.sql
npx prisma migrate status
npx prisma db pull
git diff -- prisma/schema.prisma
npx prisma migrate resolve --rolled-back "20260809090000_baseline_project_task"
git checkout backup-before-ai-reset -- prisma/migrations/20260809081800_baseline_project_task
git checkout backup-before-ai-reset -- prisma/migrations/20260811005337_add_ai_jobs
rm -rf prisma/migrations/20260809090000_baseline_project_task
git checkout HEAD -- prisma/schema.prisma
git status --short
npx prisma migrate status
npm run build
git diff --check
git status
git diff --stat
git diff -- prisma/migrations/20260809090000_baseline_project_task/migration.sql
git diff --cached --stat
git status --short
git diff --cached --name-only
git add -u prisma/migrations/20260809090000_baseline_project_task
git status --short
git commit -m "Repair Prisma migration history"
git status
git push origin master
git status
git log -1 --oneline
git push origin master
git status
git log -1 --oneline
git push origin master
openssl rand -base64 48
git diff --cached --stat
git status
git diff --stat
git diff -- prisma/migrations/20260809090000_baseline_project_task/migration.sql
git diff --cached --name-only | grep -E '(^|/)\.env|\.pem$|\.key$|credentials|secret'
git commit -m "Finalize Pulse AI and secure business workflows"
git status --short
git log -1 --oneline
git push origin master
git fetch origin
git log --oneline --decorate --graph HEAD..origin/master
git log --oneline --decorate --graph origin/master..HEAD
git branch production-01a602c
git branch --contains 01a602c
git push --force-with-lease origin master
git remote set-url origin git@github.com:Sleeky3750/Pulse.git
git remote -v
cat package.json
cat prisma/schema.prisma
ls -la prisma
find prisma -maxdepth 2 -type f -print
find prisma/migrations -maxdepth 3 -print
npx prisma migrate deploy
cd pulse -web
cd pulse-web
npm run build
grep -R 'cookieStore.get("businessId")' app lib components --exclude-dir=node_modules
sed -n '1,240p' app/api/ai/route.ts
sed -n '1,280p' lib/ai/context/loadBusinessContext.ts
sed -n '1,300p' app/api/ai/actions/route.ts
whoami
sed -n '1,360p' lib/ai/tools/actions.ts
sed -n '1,300p' lib/ai/tools/ownership.ts
grep -R 'console\.log.*\(body\|password\|business\|session\)' app lib --exclude-dir=node_modules
grep -R 'cookieStore\.get("businessId")\|cookies().get("businessId")' app lib components --exclude-dir=node_modules
sed -i '/console\.log("Request body:", body);/d' app/api/signup/route.ts
sed -i '/console\.log(data\.business);/d' app/login/page.tsx
grep -R 'console\.log.*\(body\|password\|business\|session\)' app lib --exclude-dir=node_modules
git diff --check && npm run build
sed -i '${/^$/d;}' app/dashboard/page.tsx
sed -i '${/^$/d;}' 'app/workspace/[id]/page.tsx'
sed -i 's/[[:space:]]*$//' components/project/ProjectWorkspace.tsx
git diff --check && npm run build
git status --short
git diff --stat
git add app/api/ai app/api/business app/api/login/route.ts app/api/logout/route.ts app/api/projects/route.ts app/api/signup/route.ts app/api/tasks app/api/workspaces/route.ts app/dashboard/page.tsx app/login/page.tsx app/project app/workspace app/settings components/EditTaskModal.tsx components/SettingsForm.tsx components/TaskActions.tsx components/TaskStatus.tsx components/ai components/kanban components/project lib/ai lib/auth package.json package-lock.json
git status --short
git diff --cached --stat
curl -i "https://pulse-d2yy.vercel.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=ccd61ef49d885f958aee19e5dfb1a7b6badf7fab2301a9717ad187b2adea4b11&hub.challenge=12345"
cd ~/pulse-web
sed -n '1,260p' app/api/webhooks/whatsapp/route.ts
cd ~/pulse-web && grep -nE '^model (WhatsAppConnection|Customer|Conversation|Message|Business)|^enum (ConversationStatus|ConversationMode|MessageDirection|MessageSender|MessageType)' prisma/schema.prisma
sed -n '1,230p' prisma/schema.prisma
find lib -maxdepth 3 -type f | sort | grep -E 'prisma|db|crypto|encrypt|decrypt'
cat lib/prisma.ts
npx tsc --noEmit
npm run build
npx tsc --noEmit --pretty false
git diff --check
git diff -- app/api/webhooks/whatsapp/route.ts
mkdir -p app/api/webhooks/whatsapp
cat > app/api/webhooks/whatsapp/route.ts <<'EOF'
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("WhatsApp webhook received:", {
      object: body?.object,
      entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }
}
EOF

openssl rand -hex 32
nano .env
npx tsc --noEmit
npm run build
git status
git diff -- app/api/webhooks/whatsapp/route.ts
git add prisma/schema.prisma   prisma/migrations/20260809090000_baseline_project_task   prisma/migrations/20261004163441_add_whatsapp_messaging   app/api/webhooks/whatsapp
git status
git commit -m "Add WhatsApp webhook integration"
git push origin master
curl -i "https://pulse-d2yy.vercel.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=ccd61ef49d885f958aee19e5dfb1a7b6badf7fab2301a9717ad187b2adea4b11&hub.challenge=12345"
printf '\n' >> app/api/webhooks/whatsapp/route.ts
git diff --check
npx prisma studio
cd pulse-web
nano prisma/schema.prisma
npx prisma format
npx prisma validate
npx prisma migrate dev --name add_whatsapp_messaging
cd ~/pulse-web
git status --short
git ls-tree -r --name-only backup-before-ai-reset prisma/migrations | grep 20260809090000
git ls-tree -r --name-only pre-ai-recovery prisma/migrations | grep 20260809090000
npx prisma migrate status
ls -1 prisma/migrations
npx prisma migrate diff   --from-migrations prisma/migrations   --to-schema-datamodel prisma/schema.prisma   --script > /tmp/whatsapp-migration.sql
cat /tmp/whatsapp-migration.sql
npx prisma migrate diff   --from-url "$DATABASE_URL"   --to-schema-datamodel prisma/schema.prisma   --script > /tmp/whatsapp-migration.sql
cat /tmp/whatsapp-migration.sql
npx prisma migrate dev --name add_whatsapp_messaging --create-only
git log --all --full-history --oneline -- prisma/migrations/20260809090000_baseline_project_task
git show 6c42974:prisma/migrations/20260809090000_baseline_project_task/migration.sql
git ls-tree -r --name-only a04d1dd prisma/migrations | grep 20260809090000
git ls-tree -r --name-only 23bd220 prisma/migrations | grep 20260809090000
git show a04d1dd:prisma/migrations/20260809090000_baseline_project_task/migration.sql
mkdir -p prisma/migrations/20260809090000_baseline_project_task
touch prisma/migrations/20260809090000_baseline_project_task/migration.sql
npx prisma migrate status
npx prisma migrate dev --name add_whatsapp_messaging --create-only
git show a04d1dd:prisma/migrations/20260809090000_baseline_project_task/migration.sql > prisma/migrations/20260809090000_baseline_project_task/migration.sql
npx prisma migrate status
npx prisma migrate dev --name add_whatsapp_messaging --create-only
git show 6c42974:prisma/migrations/20260809081800_baseline_project_task/migration.sql
git show a04d1dd:prisma/migrations/20260809090000_baseline_project_task/migration.sql
npx prisma db execute --stdin <<'SQL'
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260809081800_baseline_project_task',
  '20260809090000_baseline_project_task'
)
ORDER BY migration_name;
SQL

npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260809081800_baseline_project_task',
  '20260809090000_baseline_project_task'
)
ORDER BY migration_name;
SQL

psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\" WHERE migration_name IN ('20260809081800_baseline_project_task','20260809090000_baseline_project_task') ORDER BY migration_name;"
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
CREATE TEMP TABLE migration_check AS
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260809081800_baseline_project_task',
  '20260809090000_baseline_project_task'
);

COPY migration_check TO '/tmp/migration_check.csv' WITH (FORMAT csv, HEADER true);
SQL

cat /tmp/migration_check.csv
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
COPY (
  SELECT migration_name, finished_at
  FROM "_prisma_migrations"
  WHERE migration_name IN (
    '20260809081800_baseline_project_task',
    '20260809090000_baseline_project_task'
  )
  ORDER BY migration_name
) TO STDOUT WITH (FORMAT csv, HEADER true);
SQL

mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_whatsapp_messaging
ls -td prisma/migrations/*_add_whatsapp_messaging | head -1
npx prisma migrate diff   --from-url "$DATABASE_URL"   --to-schema-datamodel prisma/schema.prisma   --script   > prisma/migrations/20261004163441_add_whatsapp_messaging/migration.sql
npx prisma migrate diff   --from-schema-datasource prisma/schema.prisma   --to-schema-datamodel prisma/schema.prisma   --script   > prisma/migrations/20261004163441_add_whatsapp_messaging/migration.sql
cat prisma/migrations/20261004163441_add_whatsapp_messaging/migration.sql
sed -i '/-- DropForeignKey/,/DROP TYPE "AIJobType";/d' prisma/migrations/20261004163441_add_whatsapp_messaging/migration.sql
grep -n "AIJob\|DropTable\|DropEnum\|DropForeignKey" prisma/migrations/20261004163441_add_whatsapp_messaging/migration.sql
git diff -- prisma/migrations/20261004163441_add_whatsapp_messaging/migration.sql
npx prisma migrate diff   --from-url "$DATABASE_URL"   --to-schema-datamodel prisma/schema.prisma   --script   > /dev/null
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npx prisma migrate resolve --applied 20260809090000_baseline_project_task
npx prisma migrate status
npx prisma migrate deploy
npx localtunnel --port 3000
npm run dev
npx localtunnel --port 3000
cat .env
curl -i "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=ccd61ef49d885f958aee19e5dfb1a7b6badf7fab2301a9717ad187b2adea4b11&hub.challenge=12345"
curl -i "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=ccd61ef49d885f95&hub.challenge=5768318"
cat .env
curl -i "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=ccd61ef49d885f958aee19e5dfb1a7b6badf7fab2301a9717ad187b2adea4b11&hub.challenge=5768318"
ssh -R 80:localhost:3000 a.pinggy.io
ssh -p 443 -R0:localhost:3000 free@a.pinggy.io
ssh -p 443 -R0:localhost:3000 free@a.pinggy.io
cat .env
npx cloudflared tunnel --url http://localhost:3000
npm run dev
cd home
ls
cd ..
npm install -g @opencode/cli
sudo npm install -g @opencode/cli
cd pulse-web
opencode
open code
opencode
curl -i https://<new-random-words>.trycloudflare.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_EXACT_ENV_TOKEN&hub.challenge=1234
curl -i https://<new-random-words>.trycloudflare.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=ccd61ef49d885f958aee19e5dfb1a7b6badf7fab2301a9717ad187b2adea4b11&hub.challenge=1234
ngrok config add-authtoken 3KKOn2PAPFdjBh1n5L3ovgryZeJ_6aDRBbQ6e3XqgnaaGpphp
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc   | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null   && echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main"   | sudo tee /etc/apt/sources.list.d/ngrok.list   && sudo apt update   && sudo apt install ngrok
ngrok config add-authtoken 3KKOn2PAPFdjBh1n5L3ovgryZeJ_6aDRBbQ6e3XqgnaaGpphp
ngrok http --url=https://equipment-observer-film.ngrok-free.dev.ngrok-free.app 3000
ngrok http --url=https://equipment-observer-film.ngrok-free.app 3000
ngrok http --url=https:// 3000
curl -i -X POST http://localhost:3000/api/webhooks/whatsapp   -H "Content-Type: application/json"   -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15556350556",
            "phone_number_id": "YOUR_PHONE_NUMBER_ID"
          },
          "contacts": [{
            "profile": { "name": "Tester" },
            "wa_id": "1234567890"
          }],
          "messages": [{
            "from": "1234567890",
            "id": "wamid.HBgL...",
            "timestamp": "1670000000",
            "text": { "body": "Hello AI assistant!" },
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'
nano .env
cat .env
nano .env
cat .env
nano .env
cd pulse-web
opencode
openssl rand -base64 48
nano .env
npx prisma migrate deploy
npm run dev
npx prisma db push
ngrok http 3000
npx prisma migrate deploy
npx prisma generate
cd pulse-web
opencode
rm -f "tomerId: customer.id,"
rm -rf app/generated/
git add .
git commit -m "feat: complete unified dark UI, team roles, encrypted settings, and pulse dashboard"
git add .
git commit -m "feat: complete media fallback replies, password change invalidation, dark theme unification, and database schema alignment"
npm run dev
cd pulse-web
opencode
git add .
git commit -m "feat: complete automated WhatsApp CRM, lead scoring, and tag-based thread filtering"
npx prisma migrate dev --name add_campaigns_schema
npx prisma db push
npx prisma generate
npx prisma migrate resolve --applied "20260809090000_baseline_project_task"
git add .
git commit -m "feat: complete campaign schema sync, broadcast engine, and lead tagging pipeline"
npm run dev
git add .
git commit -m "fix: extract client-safe CRM tags to resolve server-only import build error and restore campaigns rendering"
npm run dev
npm run build
git add .
git commit -m "fix: create lib/utils with useDebounce and cn exports for console components"
npm run dev
cd pulse-web
opencode
npm run build
cd pulse-web
npm run build
npm run dev
ngrok http 3000
code .
npm run dev
cd pulse-web
opencode
cd pulse-web
opencode
npm run build
npm run dev
git add .
git commit -m "feat: add sidebar campaign nav, billing settings tab, password reset workflow, and fix broadcast modal overlay"
git push origin master
npm run dev
cd pulse-web
npm run build
git add .
git commit -m "feat: complete Pulse AI CRM, WhatsApp campaigns, billing settings, and Turbopack build fixes"
git add .
git commit -m "feat: complete Pulse AI CRM, campaign engine, billing tab, and 60+ build/type fixes"
git push origin master
nano .env
npm run dev
opencode
nano .env
code .
nano .env
npm run dev
npm run dev
cat .env
npm run dev
curl -i -X POST `
     https://graph.facebook.com/v25.0/1277659942105023/messages `
curl -i -X POST `
     https://graph.facebook.com/v25.0/1277659942105023/messages `
curl -i -X POST "https://graph.facebook.com/v20.0/1277659942105023/messages" -H "Authorization: EAAUNoHnTBQQBSpDwsMNZAKD7U9XbpXaMLhVOCS7uzX2fI3G1JMCD3SNkKklmJQIFAZAnN3iK4YaJDAZAVlnOQU9thSf2QZBvTfkZAmUEkeS0WlkPlGgck6ZAPo4BlO91qoVIp6Xic1ZAXcwTXmIoDFHTUsl8NS7oPga85YX6yWIhZCRKS2VrSArujUClDQ9uixXJcvyZBLokwAmZAukd0DRpwxrH9wNeZCuZBNJ0eRLK' ` -H "Content-Type: application/json" -d '{"messaging_product":"whatsapp","to":"2349162483537","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}'

npm run dev
cd pulse-web
opencode
cd pulse-web
opencode
cat .env
