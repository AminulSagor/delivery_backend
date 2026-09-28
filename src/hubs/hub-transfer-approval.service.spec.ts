import { BadRequestException } from '@nestjs/common';
import { AdminAccount } from '../admin/entities/admin-account.entity';
import { AdminAccountStatement } from '../admin/entities/admin-account-statement.entity';
import { TransferRecordStatus } from '../common/enums/transfer-record-status.enum';
import { HubManager } from './entities/hub-manager.entity';
import { HubManagerFinance } from './entities/hub-manager-finance.entity';
import { HubTransferRecord } from './entities/hub-transfer-record.entity';
import { HubsService } from './hubs.service';

describe('HubsService transfer approval', () => {
  function createService(records: {
    transfer: Partial<HubTransferRecord>;
    finance: Partial<HubManagerFinance>;
    account?: Partial<AdminAccount>;
    manager?: Partial<HubManager>;
  }) {
    const save = jest.fn(async (_entity, value) => value);
    const entityManager = {
      findOne: jest.fn(async (entity) => {
        if (entity === HubTransferRecord) return records.transfer;
        if (entity === HubManagerFinance) return records.finance;
        if (entity === AdminAccount) return records.account;
        if (entity === HubManager) return records.manager;
        return null;
      }),
      save,
      create: jest.fn((_entity, value) => value),
    };
    const queryRunner = {
      manager: entityManager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const notificationsService = { create: jest.fn() };
    const service = Object.create(HubsService.prototype) as HubsService;
    (service as any).dataSource = {
      createQueryRunner: () => queryRunner,
    };
    (service as any).notificationsService = notificationsService;

    return { service, entityManager, queryRunner, notificationsService };
  }

  it('moves balances and creates an account statement only on approval', async () => {
    const records = {
      transfer: {
        id: 'transfer-1',
        hub_manager_id: 'manager-1',
        hub_id: 'hub-1',
        admin_account_id: 'account-1',
        admin_account_holder_name: 'Meghswar Account',
        transaction_reference_id: 'TRF-001',
        transferred_amount: 250,
        notes: 'Hub cash transfer',
        status: TransferRecordStatus.IN_REVIEW,
        funds_reserved: false,
      },
      finance: {
        current_balance: 1000,
        total_transferred_to_admin: 100,
      },
      account: {
        id: 'account-1',
        current_balance: 500,
        is_active: true,
      },
    };
    const { service, entityManager, queryRunner } = createService(records);

    const result = await service.reviewTransfer(
      'transfer-1',
      { status: TransferRecordStatus.APPROVED },
      { userId: 'admin-1' },
    );

    expect(records.finance.current_balance).toBe(750);
    expect(records.finance.total_transferred_to_admin).toBe(350);
    expect(records.account.current_balance).toBe(750);
    expect(entityManager.create).toHaveBeenCalledWith(
      AdminAccountStatement,
      expect.objectContaining({
        credit_amount: 250,
        reference_id: 'TRF-001',
      }),
    );
    expect(result.status).toBe(TransferRecordStatus.APPROVED);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('does not move a new request balance and notifies the Hub Manager on decline', async () => {
    const records = {
      transfer: {
        id: 'transfer-2',
        hub_manager_id: 'manager-2',
        hub_id: 'hub-2',
        transaction_reference_id: 'TRF-002',
        transferred_amount: 300,
        status: TransferRecordStatus.IN_REVIEW,
        funds_reserved: false,
      },
      finance: {
        current_balance: 1000,
        total_transferred_to_admin: 500,
      },
      manager: {
        id: 'manager-2',
        user_id: 'hub-user-2',
      },
    };
    const { service, notificationsService } = createService(records);

    const result = await service.reviewTransfer(
      'transfer-2',
      {
        status: TransferRecordStatus.DECLINED,
        rejection_reason: 'Proof mismatch',
      },
      { userId: 'admin-1' },
    );

    expect(records.finance.current_balance).toBe(1000);
    expect(records.finance.total_transferred_to_admin).toBe(500);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_user_id: 'hub-user-2',
        type: 'HUB_TRANSFER_DECLINED',
        entity_id: 'transfer-2',
      }),
      expect.anything(),
    );
    expect(result.notification_sent).toBe(true);
  });

  it('returns individual failures during a bulk review', async () => {
    const service = Object.create(HubsService.prototype) as HubsService;
    service.reviewTransfer = jest
      .fn()
      .mockResolvedValueOnce({ status: TransferRecordStatus.APPROVED })
      .mockRejectedValueOnce(new BadRequestException('Insufficient balance'));

    const result = await service.reviewTransfersBulk(
      {
        transfer_ids: [
          '7c76feb0-dc97-42ad-a3ba-0ce8050f3559',
          'cbf1546c-0764-4ce5-9c5f-ef84a64a213d',
        ],
        status: TransferRecordStatus.APPROVED,
      },
      { userId: 'admin-1' },
    );

    expect(result).toMatchObject({ requested: 2, success: 1, failed: 1 });
    expect(result.results[1]).toMatchObject({
      success: false,
      error: 'Insufficient balance',
    });
  });
});
