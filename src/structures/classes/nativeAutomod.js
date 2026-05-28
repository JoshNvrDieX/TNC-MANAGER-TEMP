import { AutoModerationRuleTriggerType, AutoModerationRuleEventType, AutoModerationActionType } from 'discord.js';
import { db } from '#dbManager';
import { logger } from '#utils';

/**
 * Manages Discord's native Auto-moderation rules for a guild.
 * Syncs the bot's database configuration to Discord's native system.
 */
export class NativeAutomod {
	/**
	 * Syncs all enabled automod features to native Discord rules.
	 * @param {import('discord.js').Guild} guild 
	 * @returns {Promise<number>} Number of rules synced
	 */
	static async sync(guild) {
		if (!guild || !guild.members.me?.permissions.has('ManageGuild')) return 0;

		const cfg = db.automod.get(guild.id);
		if (!cfg) return 0;

		let synced = 0;
		try {
			const existingRules = await guild.autoModerationRules.fetch();
			
			// 1. Sync Mention Spam
			if (await this._syncMentionRule(guild, cfg, existingRules)) synced++;

			// 2. Sync Word Filter
			if (await this._syncWordFilter(guild, cfg, existingRules)) synced++;

			// 3. Sync Spam (Native)
			if (await this._syncSpamRule(guild, cfg, existingRules)) synced++;

			// 4. Sync Invite Filter (as keyword rule)
			if (await this._syncInviteRule(guild, cfg, existingRules)) synced++;

		} catch (error) {
			logger.error('NativeAutomod', `Failed to sync rules for ${guild.id}: ${error.message}`);
		}
		return synced;
	}

	/**
	 * Syncs rules for all guilds the bot is in.
	 * @param {import('discord.js').Client} client 
	 */
	static async syncAll(client) {
		const guilds = Array.from(client.guilds.cache.values());
		logger.info('NativeAutomod', `Starting global automod sync for ${guilds.length} guilds...`);
		
		let totalSynced = 0;
		for (const guild of guilds) {
			const count = await this.sync(guild).catch(e => {
				logger.error('NativeAutomod', `Sync failed for ${guild.id}: ${e.message}`);
				return 0;
			});
			totalSynced += count;
			await new Promise(r => setTimeout(r, 200));
		}
		
		logger.success('NativeAutomod', `Global automod sync completed. ${totalSynced} rules processed across ${guilds.length} guilds.`);
	}

	/** Syncs the Anti-Mention limit to native rule */
	static async _syncMentionRule(guild, cfg, existing) {
		const ruleName = '[TNC] Anti-Mention';
		const ourRule = existing.find(r => r.name === ruleName);

		if (!cfg.enabled || !cfg.antiMentionEnabled) {
			if (ourRule) {
				await ourRule.delete('Automod disabled');
				return true;
			}
			return false;
		}

		const data = {
			name: ruleName,
			eventType: AutoModerationRuleEventType.MessageSend,
			triggerType: AutoModerationRuleTriggerType.MentionSpam,
			triggerMetadata: {
				mentionTotalLimit: cfg.antiMentionLimit || 5,
			},
			actions: this._getActions(cfg.antiMentionAction, 'Mention spam'),
			enabled: true,
			exemptRoles: cfg.whitelistedRoles || [],
			exemptChannels: cfg.whitelistedChannels || [],
		};

		if (ourRule) await ourRule.edit(data);
		else await guild.autoModerationRules.create(data);
		return true;
	}

	/** Syncs the Word Filter list to native rule */
	static async _syncWordFilter(guild, cfg, existing) {
		const ruleName = '[TNC] Word Filter';
		const rule = existing.find(r => r.name === ruleName);
		const list = cfg.wordFilterList || [];

		if (!cfg.enabled || !cfg.wordFilterEnabled || list.length === 0) {
			if (rule) {
				await rule.delete('Word filter disabled');
				return true;
			}
			return false;
		}

		const data = {
			name: ruleName,
			eventType: AutoModerationRuleEventType.MessageSend,
			triggerType: AutoModerationRuleTriggerType.Keyword,
			triggerMetadata: {
				keywordFilter: list.slice(0, 1000),
			},
			actions: this._getActions(cfg.wordFilterAction, 'Banned word'),
			enabled: true,
			exemptRoles: cfg.whitelistedRoles || [],
			exemptChannels: cfg.whitelistedChannels || [],
		};

		if (rule) await rule.edit(data);
		else await guild.autoModerationRules.create(data);
		return true;
	}

	/** Syncs Anti-Spam (baseline) to native rule */
	static async _syncSpamRule(guild, cfg, existing) {
		const ruleName = '[TNC] Anti-Spam';
		const ourRule = existing.find(r => r.name === ruleName);

		if (!cfg.enabled || !cfg.antiSpamEnabled) {
			if (ourRule) {
				await ourRule.delete('Anti-spam disabled');
				return true;
			}
			return false;
		}

		const data = {
			name: ruleName,
			eventType: AutoModerationRuleEventType.MessageSend,
			triggerType: AutoModerationRuleTriggerType.Spam,
			actions: this._getActions(cfg.antiSpamAction, 'Spam detected'),
			enabled: true,
			exemptRoles: cfg.whitelistedRoles || [],
			exemptChannels: cfg.whitelistedChannels || [],
		};

		if (ourRule) await ourRule.edit(data);
		else await guild.autoModerationRules.create(data);
		return true;
	}

	/** Syncs Anti-Invite to native keyword rule */
	static async _syncInviteRule(guild, cfg, existing) {
		const ruleName = '[TNC] Anti-Invite';
		const rule = existing.find(r => r.name === ruleName);

		if (!cfg.enabled || !cfg.antiInviteEnabled) {
			if (rule) {
				await rule.delete('Anti-invite disabled');
				return true;
			}
			return false;
		}

		const data = {
			name: ruleName,
			eventType: AutoModerationRuleEventType.MessageSend,
			triggerType: AutoModerationRuleTriggerType.Keyword,
			triggerMetadata: {
				keywordFilter: ['*discord.gg/*', '*discord.com/invite/*'],
			},
			actions: this._getActions(cfg.antiInviteAction, 'Server invite'),
			enabled: true,
			exemptRoles: cfg.whitelistedRoles || [],
			exemptChannels: cfg.whitelistedChannels || [],
		};

		if (rule) await rule.edit(data);
		else await guild.autoModerationRules.create(data);
		return true;
	}

	/** Maps DB action strings to Discord Native Actions */
	static _getActions(actionStr, reason) {
		return [{
			type: AutoModerationActionType.BlockMessage,
			metadata: {
				customMessage: `Message blocked by TNC Automod: ${reason}`,
			}
		}];
	}
}
