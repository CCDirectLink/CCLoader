declare namespace ccloader {
	declare namespace manifest {
		export type ModId = string;

		export type Semver = string;
		export type SemverConstraint = string;

		export type SpdxExpression = string;

		export type Locale = string;
		export type LocalizedString = Record<Locale, string> | string;

		export type FilePath = string;

		export interface PersonDetailedInfo {
			name: LocalizedString;
			email?: LocalizedString;
			url?: LocalizedString;
			comment?: LocalizedString;
		}
		export type Person = PersonDetailedInfo | string;

		export interface Manifest {
			id: ModId;
			version: Semver;
			license?: SpdxExpression;

			title?: LocalizedString;
			description?: LocalizedString;
			homepage?: LocalizedString;
			keywords?: LocalizedString[];

			authors?: Person[];
			contributors?: Person[];
			maintainers?: Person[];

			dependencies?: Record<ModId, SemverConstraint>;

			assets?: FilePath[];
			assetsDir?: FilePath;

			plugin?: FilePath;
			preload?: FilePath;
			postload?: FilePath;
			prestart?: FilePath;
		}
	}

	export import Manifest = manifest.Manifest;
}
