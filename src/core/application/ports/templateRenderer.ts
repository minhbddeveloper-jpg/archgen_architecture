export interface TemplateRenderer {
  render(templatePath: string, context: Record<string, unknown>): Promise<string>;
}
