import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MOCK_DOCUMENTS } from "@/lib/mock-data";

const USERS = [
  { name: "Alex Nguyen", email: "alex.nguyen@example.com", status: "Active", documents: 12, joined: "2026-05-02" },
  { name: "Priya Raman", email: "priya.raman@example.com", status: "Active", documents: 4, joined: "2026-06-18" },
  { name: "Tom Fitzgerald", email: "tom.fitzgerald@example.com", status: "Suspended", documents: 1, joined: "2026-07-01" },
];

const AUDIT_LOG = [
  { actor: "System", action: "Extraction failed", target: "Bupa - Medical letter", at: "2026-08-02 09:14" },
  { actor: "platform_operator", action: "Suspended account", target: "Tom Fitzgerald", at: "2026-07-30 16:02" },
  { actor: "System", action: "Extraction completed", target: "Centrelink - Government letter", at: "2026-08-03 11:47" },
];

export default function AdminDashboardPage() {
  const failedDocuments = MOCK_DOCUMENTS.filter((doc) => doc.status === "failed");
  const needsReviewCount = MOCK_DOCUMENTS.filter((doc) => doc.status === "needs-review").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="System health and account status. Document content stays private to users."
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Users" value={USERS.length} />
            <Metric label="Documents processed" value={MOCK_DOCUMENTS.length} />
            <Metric label="Needs review" value={needsReviewCount} />
            <Metric label="Failed" value={failedDocuments.length} />
          </div>
        </TabsContent>

        <TabsContent value="processing" className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-foreground">Failed processing</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-foreground">{doc.issuer}</TableCell>
                    <TableCell className="text-muted-foreground">{doc.documentType}</TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doc.uploadedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-foreground">User accounts</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {USERS.map((user) => (
                  <TableRow key={user.email}>
                    <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">{user.status}</TableCell>
                    <TableCell className="text-muted-foreground">{user.documents}</TableCell>
                    <TableCell className="text-muted-foreground">{user.joined}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-foreground">Audit log</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {AUDIT_LOG.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-muted-foreground">{entry.actor}</TableCell>
                    <TableCell className="font-medium text-foreground">{entry.action}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.target}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3">
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
