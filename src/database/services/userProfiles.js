import { UserProfile } from '#dbSchema/userProfiles';
import { logger } from '#utils';

export class UserProfileService {
	constructor() {
		this.repo = UserProfile;
	}

	async getProfile(userId) {
		return this.repo.findOrCreate(userId);
	}

	async updateProfile(userId, data) {
		this.repo.findOrCreate(userId);
		this.repo.update(userId, data);
	}

	async setTagline(userId, tagline) {
		this.repo.findOrCreate(userId);
		this.repo.update(userId, { tagline });
	}

	async setDescription(userId, description) {
		this.repo.findOrCreate(userId);
		this.repo.update(userId, { description });
	}

	async setLocation(userId, location) {
		this.repo.findOrCreate(userId);
		this.repo.update(userId, { location });
	}

	async setAge(userId, age) {
		this.repo.findOrCreate(userId);
		this.repo.update(userId, { age });
	}

	async setProfession(userId, profession) {
		this.repo.findOrCreate(userId);
		this.repo.update(userId, { profession });
	}

	async setBannerUrl(userId, bannerUrl) {
		this.repo.findOrCreate(userId);
		this.repo.update(userId, { bannerUrl });
	}

	async clearProfile(userId) {
		this.repo.update(userId, {
			tagline: null,
			description: null,
			location: null,
			age: null,
			profession: null,
			bannerUrl: null,
		});
	}

	async deleteProfile(userId) {
		this.repo.delete(userId);
	}
}
