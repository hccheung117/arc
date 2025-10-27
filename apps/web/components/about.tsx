"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Import version information from workspace root
// Using dynamic import path that Next.js can resolve
import versionJson from "../../../version.json";

const versionData: { version: string; buildDate: string } | null = versionJson || null;

export function About() {
  const version = versionData?.version || "Version unavailable";
  const buildDate = versionData?.buildDate || "Not available";

  return (
    <Card>
      <CardHeader>
        <CardTitle>About Arc</CardTitle>
        <CardDescription>
          Application information and updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Application Information */}
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">Application</span>
            <span className="text-sm font-semibold">Arc</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">Version</span>
            <span className="text-sm font-mono">{version}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">Build Date</span>
            <span className="text-sm">{buildDate}</span>
          </div>
        </div>

        {/* Check for Updates Button */}
        <div className="pt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button disabled className="w-full" variant="secondary">
                    Check for Updates
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
