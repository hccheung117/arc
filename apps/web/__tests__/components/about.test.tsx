import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { About } from "@/components/about";

describe("About Component", () => {
  it("should render the About card with application information", () => {
    render(<About />);

    // Check for card title
    expect(screen.getByText("About Arc")).toBeInTheDocument();
    expect(screen.getByText("Application information and updates")).toBeInTheDocument();

    // Check for application name
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByText("Arc")).toBeInTheDocument();

    // Check for version label
    expect(screen.getByText("Version")).toBeInTheDocument();

    // Check for build date label
    expect(screen.getByText("Build Date")).toBeInTheDocument();
  });

  it("should render the Check for Updates button as disabled", () => {
    render(<About />);

    const button = screen.getByRole("button", { name: /check for updates/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("should display version from version.json or fallback", () => {
    render(<About />);

    // Version should either be from version.json (0.1.0) or fallback
    const versionText = screen.getByText(/Version/);
    expect(versionText).toBeInTheDocument();

    // Check that there's some version displayed (either real or fallback)
    const versionValue = screen.getByText(/0\.1\.0|Version unavailable/);
    expect(versionValue).toBeInTheDocument();
  });

  it("should display build date from version.json or fallback", () => {
    render(<About />);

    // Build date should be displayed
    const buildDateLabel = screen.getByText("Build Date");
    expect(buildDateLabel).toBeInTheDocument();

    // Check that there's some date displayed (either real or fallback)
    const buildDateValue = screen.getByText(/2025-10-27|Not available/);
    expect(buildDateValue).toBeInTheDocument();
  });
});
