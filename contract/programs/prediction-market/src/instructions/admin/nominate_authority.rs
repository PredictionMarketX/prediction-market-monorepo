use constants::CONFIG;
use errors::PredictionMarketError;
// use state::config::*;

use crate::*;

#[derive(Accounts)]
pub struct NominateAuthority<'info> {
    // Current admin
    #[account(
        mut,
        constraint = global_config.authority == *admin.key @PredictionMarketError::IncorrectAuthority
    )]
    pub admin: Signer<'info>,

    //  Stores admin address
    #[account(
        mut,
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    global_config: Box<Account<'info, Config>>,
}

impl NominateAuthority<'_> {
    pub fn process(&mut self, new_admin: Pubkey) -> Result<()> {
        let current_authority = self.global_config.authority;
        self.global_config.pending_authority = new_admin;

        // ✅ v3.0.2: 发射权限提名事件
        let clock = Clock::get()?;
        emit!(crate::events::AuthorityNominatedEvent {
            current_authority,
            nominated_authority: new_admin,
            timestamp: clock.unix_timestamp,
        });

        msg!(
            "✅ Authority nominated: {} → {} (pending acceptance)",
            current_authority,
            new_admin
        );

        Ok(())
    }
}
