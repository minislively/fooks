/**
 * Layer 2 Frontend Task Benchmark - Manifest Loader
 *
 * Loads and validates manifest.json for deterministic benchmark execution.
 * Based on: docs/benchmarks/v2/TAXONOMY_AND_METRICS_FINAL.md
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface RepoMetadata {
  name: string;
  revision: string;
  localPath: string;
  discoveryGlobs: string[];
  excludeGlobs: string[];
  countRule: 'all-tsx' | 'sampled';
  supportedBuckets: string[];
  excludedBuckets: string[];
  comparativeGating: boolean;
  bucketLimits: Record<string, number>;
}

export interface BucketDefinition {
  id: string;
  name: string;
  classificationCriteria: string[];
  targetSampleSize: number;
  deficitThresholdPct: number;
}

export interface Manifest {
  schemaVersion: string;
  createdAt: string;
  repos: RepoMetadata[];
  buckets: BucketDefinition[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ManifestLoader {
  private manifest: Manifest | null = null;
  private manifestPath: string;

  constructor(manifestPath: string = '../v2/manifest.json') {
    this.manifestPath = resolve(manifestPath);
  }

  /**
   * Load manifest from disk and parse
   */
  load(): Manifest {
    try {
      const content = readFileSync(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(content) as Manifest;
      return this.manifest;
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error}`);
    }
  }

  /**
   * Validate manifest structure and constraints
   */
  validate(): ValidationResult {
    if (!this.manifest) {
      this.load();
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema version check
    if (!this.manifest!.schemaVersion) {
      errors.push('Missing schemaVersion');
    } else if (!this.manifest!.schemaVersion.startsWith('fooks-benchmark.v2')) {
      warnings.push(`Unexpected schema version: ${this.manifest!.schemaVersion}`);
    }

    // Repo validation
    if (!this.manifest!.repos || this.manifest!.repos.length === 0) {
      errors.push('No repos defined in manifest');
    } else {
      for (const repo of this.manifest!.repos) {
        if (!repo.revision) {
          errors.push(`Repo ${repo.name}: missing revision`);
        }
        if (!repo.localPath) {
          errors.push(`Repo ${repo.name}: missing localPath`);
        }
        if (!repo.supportedBuckets || repo.supportedBuckets.length === 0) {
          warnings.push(`Repo ${repo.name}: no supportedBuckets defined`);
        }
      }
    }

    // Bucket validation
    if (!this.manifest!.buckets || this.manifest!.buckets.length === 0) {
      errors.push('No buckets defined in manifest');
    } else {
      for (const bucket of this.manifest!.buckets) {
        if (!bucket.targetSampleSize || bucket.targetSampleSize < 1) {
          errors.push(`Bucket ${bucket.id}: invalid targetSampleSize`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get repo metadata by name
   */
  getRepo(name: string): RepoMetadata | undefined {
    if (!this.manifest) {
      this.load();
    }
    return this.manifest!.repos.find(r => r.name === name);
  }

  /**
   * Get bucket definition by ID
   */
  getBucket(id: string): BucketDefinition | undefined {
    if (!this.manifest) {
      this.load();
    }
    return this.manifest!.buckets.find(b => b.id === id);
  }

  /**
   * Get comparative gating repos only
   */
  getComparativeRepos(): RepoMetadata[] {
    if (!this.manifest) {
      this.load();
    }
    return this.manifest!.repos.filter(r => r.comparativeGating);
  }
}

// CLI entry point
if (require.main === module) {
  const loader = new ManifestLoader();
  try {
    const manifest = loader.load();
    const validation = loader.validate();

    console.log(`Manifest loaded: ${manifest.schemaVersion}`);
    console.log(`Repos: ${manifest.repos.length}`);
    console.log(`Buckets: ${manifest.buckets.length}`);
    console.log(`Valid: ${validation.valid}`);

    if (validation.errors.length > 0) {
      console.error('Errors:', validation.errors);
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.warn('Warnings:', validation.warnings);
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal:', error);
    process.exit(1);
  }
}
